<?php
/**
 * API B2B MWE Autopeças - v2.0
 * Segurança: JWT Auth, bcrypt, CORS restrito, validação de uploads, audit logs
 */

// ============================================================
// CONFIGURAÇÃO VIA .ENV
// ============================================================
function loadEnv($path = __DIR__ . '/.env') {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        if (strpos($line, '=') === false) continue;
        list($key, $value) = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        // Remove aspas se existirem
        if (preg_match('/^(["\'])(.*)\\1$/', $value, $m)) $value = $m[2];
        $_ENV[$key] = $value;
        putenv("$key=$value");
    }
}
loadEnv();

// ============================================================
// CORS RESTRITO
// ============================================================
$allowedOrigins = array_filter(array_map('trim', explode(',', getenv('CORS_ORIGINS') ?: '*')));
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if (in_array('*', $allowedOrigins) || in_array($origin, $allowedOrigins)) {
    header("Access-Control-Allow-Origin: " . ($origin ?: '*'));
} else if (!empty($allowedOrigins) && $origin) {
    http_response_code(403);
    echo json_encode(["error" => "Origem não permitida"]);
    exit;
}

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS, DELETE, PUT");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Credentials: true");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("X-XSS-Protection: 1; mode=block");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ============================================================
// CONEXÃO COM BANCO DE DADOS
// ============================================================
$host = getenv('DB_HOST') ?: 'localhost';
$db_name = getenv('DB_NAME') ?: 'u608788898_catalogo';
$username = getenv('DB_USER') ?: 'root';
$password = getenv('DB_PASS') ?: '';

try {
    $conn = new PDO(
        "mysql:host=$host;dbname=$db_name;charset=utf8mb4",
        $username,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Erro de conexão com o banco de dados"]);
    exit;
}

// ============================================================
// JWT HELPERS
// ============================================================
$jwtSecret = getenv('JWT_SECRET') ?: 'CHAVE_PADRAO_TROCAR_EM_PRODUCAO_' . md5($db_name);

function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    return base64_decode(strtr($data, '-_', '+/'));
}

function jwtEncode($payload, $secret) {
    $header = base64url_encode(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $payload['iat'] = time();
    $payload['exp'] = time() + (60 * 60 * 24 * 7); // 7 dias
    $payloadB64 = base64url_encode(json_encode($payload));
    $signature = base64url_encode(hash_hmac('sha256', "$header.$payloadB64", $secret, true));
    return "$header.$payloadB64.$signature";
}

function jwtDecode($token, $secret) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;

    list($headerB64, $payloadB64, $signatureB64) = $parts;
    $expectedSig = base64url_encode(hash_hmac('sha256', "$headerB64.$payloadB64", $secret, true));

    if (!hash_equals($expectedSig, $signatureB64)) return null;

    $payload = json_decode(base64url_decode($payloadB64), true);
    if (!$payload) return null;

    // Verificar expiração
    if (isset($payload['exp']) && $payload['exp'] < time()) return null;

    return $payload;
}

function getAuthUser() {
    global $jwtSecret;
    $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

    if (preg_match('/Bearer\s+(.+)/i', $authHeader, $matches)) {
        return jwtDecode($matches[1], $jwtSecret);
    }
    return null;
}

function requireAuth($requiredRole = null) {
    $user = getAuthUser();
    if (!$user) {
        http_response_code(401);
        echo json_encode(["error" => "Não autorizado. Faça login novamente."]);
        exit;
    }
    if ($requiredRole && $user['role'] !== $requiredRole && $user['role'] !== 'ADMIN') {
        http_response_code(403);
        echo json_encode(["error" => "Permissão insuficiente."]);
        exit;
    }
    return $user;
}

// ============================================================
// HELPERS
// ============================================================
function jsonResponse($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function getClientIp() {
    return $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['HTTP_X_REAL_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

function auditLog($conn, $userId, $userName, $action, $entity, $entityId = null, $details = null) {
    try {
        // Verificar se tabela existe (auto-criar se não)
        $conn->exec("CREATE TABLE IF NOT EXISTS audit_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            userId VARCHAR(36) NOT NULL,
            userName VARCHAR(255) DEFAULT '',
            action VARCHAR(100) NOT NULL,
            entity VARCHAR(50) NOT NULL,
            entityId VARCHAR(36) DEFAULT NULL,
            details TEXT,
            ip VARCHAR(45) DEFAULT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_audit_date (createdAt)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $stmt = $conn->prepare("INSERT INTO audit_logs (userId, userName, action, entity, entityId, details, ip) VALUES (:userId, :userName, :action, :entity, :entityId, :details, :ip)");
        $stmt->execute([
            ':userId' => $userId,
            ':userName' => $userName,
            ':action' => $action,
            ':entity' => $entity,
            ':entityId' => $entityId,
            ':details' => $details,
            ':ip' => getClientIp()
        ]);
    } catch (Exception $e) {
        // Silenciar erros de auditoria para não quebrar a operação principal
        error_log("Audit log error: " . $e->getMessage());
    }
}

function sanitizeString($str) {
    if ($str === null) return '';
    return htmlspecialchars(strip_tags(trim($str)), ENT_QUOTES, 'UTF-8');
}

function validateEmail($email) {
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

// Migração automática de senhas: converte texto puro para bcrypt no login
function migratePasswordIfNeeded($conn, $userId, $plainPassword) {
    $hash = password_hash($plainPassword, PASSWORD_BCRYPT, ['cost' => 12]);
    $stmt = $conn->prepare("UPDATE users SET password = :password WHERE id = :id");
    $stmt->execute([':password' => $hash, ':id' => $userId]);
    return $hash;
}

// Auto-migração de colunas (só roda uma vez, erros são silenciados)
function ensureColumns($conn) {
    $migrations = [
        "ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN lastLogin DATETIME DEFAULT NULL",
        "ALTER TABLE orders ADD COLUMN clientName VARCHAR(255) DEFAULT NULL AFTER userStoreName",
        "ALTER TABLE orders ADD COLUMN resellerClientId VARCHAR(36) DEFAULT NULL AFTER clientName",
        "ALTER TABLE orders ADD COLUMN paymentMethod VARCHAR(255) DEFAULT NULL AFTER resellerClientId",
        "ALTER TABLE orders ADD COLUMN observations TEXT DEFAULT NULL AFTER paymentMethod",
        "ALTER TABLE orders ADD COLUMN totalDiscount DECIMAL(12,2) DEFAULT 0 AFTER total",
        "ALTER TABLE orders ADD COLUMN orderDiscountPercent DECIMAL(5,2) DEFAULT 0 AFTER totalDiscount",
        "ALTER TABLE settings ADD COLUMN websiteUrl VARCHAR(255) DEFAULT ''",
        "ALTER TABLE settings ADD COLUMN customAddress TEXT",
        "ALTER TABLE settings ADD COLUMN paymentPoliciesJson LONGTEXT",
        "ALTER TABLE settings ADD COLUMN promoBannerUrl VARCHAR(500) DEFAULT ''",
    ];
    foreach ($migrations as $sql) {
        try { $conn->exec($sql); } catch (PDOException $e) { /* coluna já existe */ }
    }
}

// Rodar auto-migrações uma vez
ensureColumns($conn);

// Criar tabela reseller_clients se não existir
$conn->exec("CREATE TABLE IF NOT EXISTS reseller_clients (
    id VARCHAR(36) PRIMARY KEY,
    resellerId VARCHAR(36) NOT NULL,
    linkedUserId VARCHAR(36) DEFAULT NULL,
    companyName VARCHAR(255) NOT NULL,
    tradeName VARCHAR(255) DEFAULT '',
    cnpj VARCHAR(20) DEFAULT '',
    phone VARCHAR(20) DEFAULT '',
    email VARCHAR(100) DEFAULT '',
    notes TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_reseller (resellerId)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// ============================================================
// ROTEAMENTO
// ============================================================
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents("php://input"), true);

try {
    switch($action) {

        // =========================================================
        // AUTENTICAÇÃO (rotas públicas)
        // =========================================================
        case 'login':
            if (empty($input['email']) || empty($input['password'])) {
                http_response_code(400);
                jsonResponse(["error" => "E-mail e senha são obrigatórios."]);
            }

            $email = strtolower(trim($input['email']));
            if (!validateEmail($email)) {
                http_response_code(400);
                jsonResponse(["error" => "E-mail inválido."]);
            }

            $stmt = $conn->prepare("SELECT * FROM users WHERE email = :email LIMIT 1");
            $stmt->execute([':email' => $email]);
            $user = $stmt->fetch();

            if (!$user) {
                http_response_code(401);
                jsonResponse(["error" => "E-mail não cadastrado."]);
            }

            // Verificar senha: suporta bcrypt e migração de texto puro
            $passwordValid = false;
            if (password_get_info($user['password'])['algo'] !== null && password_get_info($user['password'])['algo'] !== 0) {
                // Senha já é bcrypt
                $passwordValid = password_verify($input['password'], $user['password']);
            } else {
                // Senha em texto puro (legado) - verificar e migrar
                $passwordValid = ($user['password'] === $input['password'] && strlen($input['password']) > 0);
                if ($passwordValid) {
                    migratePasswordIfNeeded($conn, $user['id'], $input['password']);
                }
            }

            if (!$passwordValid) {
                http_response_code(401);
                jsonResponse(["error" => "Senha incorreta."]);
            }

            // Verificar status
            if ($user['status'] !== 'APPROVED') {
                $messages = [
                    'PENDING' => 'Sua conta está em fase de análise pela nossa equipe.',
                    'REJECTED' => 'Sua solicitação de acesso foi recusada.',
                    'INACTIVE' => 'Sua conta está inativa. Entre em contato com o suporte.'
                ];
                http_response_code(403);
                jsonResponse([
                    "error" => $messages[$user['status']] ?? 'Conta não aprovada.',
                    "status" => $user['status']
                ]);
            }

            // Atualizar lastLogin
            $stmt = $conn->prepare("UPDATE users SET lastLogin = NOW() WHERE id = :id");
            $stmt->execute([':id' => $user['id']]);

            // Gerar JWT
            $permissions = json_decode($user['permissions'] ?? '[]', true) ?: [];
            $token = jwtEncode([
                'userId' => $user['id'],
                'email' => $user['email'],
                'role' => $user['role'],
                'permissions' => $permissions,
                'storeName' => $user['storeName']
            ], $jwtSecret);

            auditLog($conn, $user['id'], $user['storeName'], 'LOGIN', 'users', $user['id']);

            // Retornar dados do usuário (sem senha) + token
            unset($user['password']);
            $user['permissions'] = $permissions;
            $user['lastLogin'] = date('c');

            jsonResponse([
                "token" => $token,
                "user" => $user
            ]);
            break;

        case 'register':
            if (empty($input['email']) || empty($input['password']) || empty($input['storeName'])) {
                http_response_code(400);
                jsonResponse(["error" => "Dados incompletos."]);
            }

            $email = strtolower(trim($input['email']));
            if (!validateEmail($email)) {
                http_response_code(400);
                jsonResponse(["error" => "E-mail inválido."]);
            }

            if (strlen($input['password']) < 6) {
                http_response_code(400);
                jsonResponse(["error" => "A senha deve ter no mínimo 6 caracteres."]);
            }

            // Verificar e-mail duplicado
            $stmt = $conn->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
            $stmt->execute([':email' => $email]);
            if ($stmt->fetch()) {
                http_response_code(409);
                jsonResponse(["error" => "Este e-mail já está cadastrado."]);
            }

            $hashedPassword = password_hash($input['password'], PASSWORD_BCRYPT, ['cost' => 12]);

            $stmt = $conn->prepare("INSERT INTO users (id, storeName, responsibleName, cnpj, phone, email, password, role, status, createdAt)
                VALUES (:id, :storeName, :responsibleName, :cnpj, :phone, :email, :password, :role, :status, :createdAt)");
            $stmt->execute([
                ':id' => $input['id'] ?? bin2hex(random_bytes(18)),
                ':storeName' => sanitizeString($input['storeName']),
                ':responsibleName' => sanitizeString($input['responsibleName'] ?? ''),
                ':cnpj' => sanitizeString($input['cnpj'] ?? ''),
                ':phone' => sanitizeString($input['phone'] ?? ''),
                ':email' => $email,
                ':password' => $hashedPassword,
                ':role' => $input['role'] ?? 'RETAILER',
                ':status' => 'PENDING',
                ':createdAt' => $input['createdAt'] ?? date('c')
            ]);

            auditLog($conn, $input['id'] ?? 'new', sanitizeString($input['storeName']), 'REGISTER', 'users');

            jsonResponse(["success" => true, "message" => "Cadastro enviado com sucesso."]);
            break;

        case 'requestPasswordReset':
            $email = strtolower(trim($input['email'] ?? ''));
            if (!validateEmail($email)) {
                // Sempre retorna sucesso para não expor se o email existe
                jsonResponse(["success" => true, "message" => "Se o e-mail existir, um código de recuperação será enviado."]);
            }

            // Criar tabela se não existir
            $conn->exec("CREATE TABLE IF NOT EXISTS password_resets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(100) NOT NULL,
                token VARCHAR(64) NOT NULL UNIQUE,
                expiresAt DATETIME NOT NULL,
                used TINYINT(1) DEFAULT 0,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            $stmt = $conn->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
            $stmt->execute([':email' => $email]);

            if ($stmt->fetch()) {
                $token = bin2hex(random_bytes(32));
                $expiresAt = date('Y-m-d H:i:s', strtotime('+1 hour'));

                // Invalidar tokens anteriores
                $conn->prepare("UPDATE password_resets SET used = 1 WHERE email = :email")->execute([':email' => $email]);

                $stmt = $conn->prepare("INSERT INTO password_resets (email, token, expiresAt) VALUES (:email, :token, :expiresAt)");
                $stmt->execute([':email' => $email, ':token' => $token, ':expiresAt' => $expiresAt]);

                auditLog($conn, '', $email, 'PASSWORD_RESET_REQUEST', 'users', null, "Token gerado para: $email");
            }

            // Sempre retorna o mesmo para não expor se email existe
            jsonResponse(["success" => true, "message" => "Se o e-mail existir no sistema, um código de recuperação foi gerado. Entre em contato com o suporte informando seu e-mail."]);
            break;

        case 'resetPassword':
            $token = $input['token'] ?? '';
            $newPassword = $input['newPassword'] ?? '';

            if (empty($token) || strlen($newPassword) < 6) {
                http_response_code(400);
                jsonResponse(["error" => "Token e nova senha (mín. 6 caracteres) são obrigatórios."]);
            }

            $stmt = $conn->prepare("SELECT * FROM password_resets WHERE token = :token AND used = 0 AND expiresAt > NOW() LIMIT 1");
            $stmt->execute([':token' => $token]);
            $reset = $stmt->fetch();

            if (!$reset) {
                http_response_code(400);
                jsonResponse(["error" => "Token inválido ou expirado."]);
            }

            $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
            $conn->prepare("UPDATE users SET password = :password WHERE email = :email")->execute([
                ':password' => $hashedPassword,
                ':email' => $reset['email']
            ]);

            $conn->prepare("UPDATE password_resets SET used = 1 WHERE id = :id")->execute([':id' => $reset['id']]);

            auditLog($conn, '', $reset['email'], 'PASSWORD_RESET_COMPLETE', 'users', null, "Senha alterada via token");

            jsonResponse(["success" => true, "message" => "Senha alterada com sucesso."]);
            break;

        // =========================================================
        // PRODUTOS (autenticado)
        // =========================================================
        case 'getProducts':
            // Público para usuários logados
            requireAuth();

            // Paginação server-side opcional
            $page = max(1, (int)($_GET['page'] ?? 0));
            $limit = min(200, max(1, (int)($_GET['limit'] ?? 0)));
            $searchQuery = $_GET['search'] ?? '';

            if ($page && $limit) {
                // Paginação ativada
                $offset = ($page - 1) * $limit;

                $where = '';
                $params = [];
                if ($searchQuery) {
                    $where = "WHERE (name LIKE :search OR internalCode LIKE :search2 OR parallelCodes LIKE :search3 OR application LIKE :search4)";
                    $searchTerm = "%$searchQuery%";
                    $params = [':search' => $searchTerm, ':search2' => $searchTerm, ':search3' => $searchTerm, ':search4' => $searchTerm];
                }

                $countStmt = $conn->prepare("SELECT COUNT(*) FROM products $where");
                $countStmt->execute($params);
                $total = $countStmt->fetchColumn();

                $stmt = $conn->prepare("SELECT * FROM products $where ORDER BY name LIMIT :limit OFFSET :offset");
                foreach ($params as $k => $v) $stmt->bindValue($k, $v);
                $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
                $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
                $stmt->execute();
                $products = $stmt->fetchAll();

                $products = array_map('mapProduct', $products);
                jsonResponse([
                    "data" => $products,
                    "total" => (int)$total,
                    "page" => $page,
                    "limit" => $limit,
                    "totalPages" => ceil($total / $limit)
                ]);
            } else {
                // Sem paginação (compatibilidade com frontend atual)
                $stmt = $conn->query("SELECT * FROM products");
                $products = $stmt->fetchAll();
                jsonResponse(array_map('mapProduct', $products));
            }
            break;

        case 'saveProduct':
            $authUser = requireAuth();
            if ($authUser['role'] !== 'ADMIN' && !in_array('admin_panel', $authUser['permissions'] ?? [])) {
                http_response_code(403);
                jsonResponse(["error" => "Sem permissão para editar produtos."]);
            }

            $compatibilityJson = !empty($input['compatibility']) ? json_encode($input['compatibility'], JSON_UNESCAPED_UNICODE) : '[]';

            $sql = "REPLACE INTO products (id, internalCode, parallelCodes, name, description, manufacturer, vehicle, compatibility_json, application, kitComponents, group_name, position, price, promo_price, min_stock_display, images, stock, active)
                    VALUES (:id, :internalCode, :parallelCodes, :name, :description, :manufacturer, :vehicle, :compatibility_json, :application, :kitComponents, :group_name, :position, :price, :promo_price, :min_stock_display, :images, :stock, :active)";
            $stmt = $conn->prepare($sql);

            $params = [
                ':id' => $input['id'],
                ':internalCode' => sanitizeString($input['internalCode'] ?? ''),
                ':parallelCodes' => sanitizeString($input['parallelCodes'] ?? ''),
                ':name' => sanitizeString($input['name'] ?? ''),
                ':description' => $input['description'] ?? '',
                ':manufacturer' => sanitizeString($input['manufacturer'] ?? ''),
                ':vehicle' => sanitizeString($input['vehicle'] ?? ''),
                ':compatibility_json' => $compatibilityJson,
                ':application' => $input['application'] ?? '',
                ':kitComponents' => sanitizeString($input['kitComponents'] ?? ''),
                ':group_name' => $input['group'] ?? '',
                ':position' => $input['position'] ?? '',
                ':price' => (float)($input['price'] ?? 0),
                ':promo_price' => (float)($input['promo_price'] ?? 0),
                ':min_stock_display' => $input['min_stock_display'] ?? null,
                ':images' => json_encode($input['images'] ?? []),
                ':stock' => (int)($input['stock'] ?? 0),
                ':active' => ($input['active'] ?? false) ? 1 : 0
            ];

            $stmt->execute($params);
            auditLog($conn, $authUser['userId'], $authUser['storeName'] ?? '', 'SAVE_PRODUCT', 'products', $input['id'], $input['name'] ?? '');
            jsonResponse($input);
            break;

        case 'saveProductsBulk':
            $authUser = requireAuth();
            if ($authUser['role'] !== 'ADMIN') {
                http_response_code(403);
                jsonResponse(["error" => "Apenas administradores podem fazer upload em massa."]);
            }

            try {
                ini_set('memory_limit', '256M');
                set_time_limit(300);

                $conn->beginTransaction();

                $shouldClean = filter_var($_GET['clean'] ?? 'false', FILTER_VALIDATE_BOOLEAN);

                if ($shouldClean) {
                    // Contar produtos antes de limpar para o log
                    $countBefore = $conn->query("SELECT COUNT(*) FROM products")->fetchColumn();
                    $conn->exec("DELETE FROM products");
                    auditLog($conn, $authUser['userId'], $authUser['storeName'] ?? '', 'BULK_CLEAN_PRODUCTS', 'products', null, "Removidos $countBefore produtos antes do upload");
                }

                if (!is_array($input)) {
                    throw new Exception("Dados inválidos: esperado array de produtos.");
                }

                $sql = "INSERT INTO products (id, internalCode, parallelCodes, name, description, manufacturer, vehicle, compatibility_json, application, kitComponents, group_name, position, price, promo_price, min_stock_display, images, stock, active)
                        VALUES (:id, :internalCode, :parallelCodes, :name, :description, :manufacturer, :vehicle, :compatibility_json, :application, :kitComponents, :group_name, :position, :price, :promo_price, :min_stock_display, :images, :stock, :active)";
                $stmt = $conn->prepare($sql);

                $errors = [];
                $successCount = 0;

                foreach ($input as $index => $product) {
                    // Validação básica de campos obrigatórios
                    if (empty($product['id']) || empty($product['name'])) {
                        $errors[] = "Linha " . ($index + 1) . ": ID e Nome são obrigatórios.";
                        continue;
                    }

                    try {
                        $compatibilityJson = isset($product['compatibility']) ? json_encode($product['compatibility'], JSON_UNESCAPED_UNICODE) : '[]';

                        $params = [
                            ':id' => $product['id'],
                            ':internalCode' => $product['internalCode'] ?? '',
                            ':parallelCodes' => $product['parallelCodes'] ?? '',
                            ':name' => $product['name'] ?? '',
                            ':description' => $product['description'] ?? '',
                            ':manufacturer' => $product['manufacturer'] ?? '',
                            ':vehicle' => $product['vehicle'] ?? '',
                            ':compatibility_json' => $compatibilityJson,
                            ':application' => $product['application'] ?? '',
                            ':kitComponents' => $product['kitComponents'] ?? '',
                            ':group_name' => $product['group'] ?? '',
                            ':position' => $product['position'] ?? '',
                            ':price' => (float)($product['price'] ?? 0),
                            ':promo_price' => (float)($product['promo_price'] ?? 0),
                            ':min_stock_display' => $product['min_stock_display'] ?? null,
                            ':images' => json_encode($product['images'] ?? []),
                            ':stock' => (int)($product['stock'] ?? 0),
                            ':active' => ($product['active'] ?? false) ? 1 : 0
                        ];
                        $stmt->execute($params);
                        $successCount++;
                    } catch (Exception $e) {
                        $errors[] = "Linha " . ($index + 1) . " ({$product['name']}): " . $e->getMessage();
                    }
                }

                $conn->commit();
                auditLog($conn, $authUser['userId'], $authUser['storeName'] ?? '', 'BULK_UPLOAD_PRODUCTS', 'products', null, "Importados: $successCount, Erros: " . count($errors));

                jsonResponse([
                    "success" => true,
                    "count" => $successCount,
                    "errors" => $errors
                ]);
            } catch (Exception $e) {
                $conn->rollBack();
                http_response_code(500);
                echo json_encode(["error" => "Erro no upload em massa: " . $e->getMessage()]);
            }
            break;

        case 'deleteProduct':
            $authUser = requireAuth();
            if ($authUser['role'] !== 'ADMIN') {
                http_response_code(403);
                jsonResponse(["error" => "Sem permissão."]);
            }
            $id = $_GET['id'] ?? '';
            if (empty($id)) {
                http_response_code(400);
                jsonResponse(["error" => "ID do produto é obrigatório."]);
            }
            $stmt = $conn->prepare("DELETE FROM products WHERE id = :id");
            $stmt->execute([':id' => $id]);
            auditLog($conn, $authUser['userId'], $authUser['storeName'] ?? '', 'DELETE_PRODUCT', 'products', $id);
            jsonResponse(["success" => true]);
            break;

        // =========================================================
        // USUÁRIOS (admin)
        // =========================================================
        case 'getUsers':
            $authUser = requireAuth();
            // Admins e resellers com admin_panel podem ver usuários
            if ($authUser['role'] !== 'ADMIN' && !in_array('admin_panel', $authUser['permissions'] ?? [])) {
                http_response_code(403);
                jsonResponse(["error" => "Sem permissão."]);
            }

            $stmt = $conn->query("SELECT id, storeName, responsibleName, cnpj, phone, email, role, status, createdAt, lastLogin, permissions FROM users ORDER BY createdAt DESC");
            $users = $stmt->fetchAll();
            foreach($users as &$u) {
                $u['permissions'] = json_decode($u['permissions'] ?? '[]', true) ?: [];
            }
            jsonResponse($users);
            break;

        case 'saveUser':
            $authUser = requireAuth();

            // Usuários podem editar a si mesmos (perfil), admins podem editar qualquer um
            $isEditingSelf = ($authUser['userId'] === $input['id']);
            $isAdmin = ($authUser['role'] === 'ADMIN');
            $hasAdminPanel = in_array('admin_panel', $authUser['permissions'] ?? []);

            if (!$isEditingSelf && !$isAdmin && !$hasAdminPanel) {
                http_response_code(403);
                jsonResponse(["error" => "Sem permissão."]);
            }

            // Se password vazio, manter o atual do banco
            if (empty($input['password'])) {
               $currStmt = $conn->prepare("SELECT password FROM users WHERE id = :id");
               $currStmt->execute([':id' => $input['id']]);
               $curr = $currStmt->fetch();
               $input['password'] = $curr['password'] ?? '';
            } else {
                // Nova senha: hashear com bcrypt
                $input['password'] = password_hash($input['password'], PASSWORD_BCRYPT, ['cost' => 12]);
            }

            $permissionsJson = !empty($input['permissions']) ? json_encode($input['permissions'], JSON_UNESCAPED_UNICODE) : null;

            $sql = "REPLACE INTO users (id, storeName, responsibleName, cnpj, phone, email, password, role, status, createdAt, permissions, lastLogin)
                    VALUES (:id, :storeName, :responsibleName, :cnpj, :phone, :email, :password, :role, :status, :createdAt, :permissions, :lastLogin)";
            $stmt = $conn->prepare($sql);
            $params = [
                ':id' => $input['id'],
                ':storeName' => sanitizeString($input['storeName'] ?? ''),
                ':responsibleName' => sanitizeString($input['responsibleName'] ?? ''),
                ':cnpj' => sanitizeString($input['cnpj'] ?? ''),
                ':phone' => sanitizeString($input['phone'] ?? ''),
                ':email' => strtolower(trim($input['email'] ?? '')),
                ':password' => $input['password'],
                ':role' => $input['role'] ?? 'RETAILER',
                ':status' => $input['status'] ?? 'PENDING',
                ':createdAt' => $input['createdAt'] ?? date('c'),
                ':permissions' => $permissionsJson,
                ':lastLogin' => $input['lastLogin'] ?? null
            ];
            $stmt->execute($params);

            $actionType = $isEditingSelf ? 'UPDATE_PROFILE' : 'UPDATE_USER';
            auditLog($conn, $authUser['userId'], $authUser['storeName'] ?? '', $actionType, 'users', $input['id'], "Status: " . ($input['status'] ?? ''));

            $input['permissions'] = $input['permissions'] ?? [];
            unset($input['password']); // Nunca retornar senha
            jsonResponse($input);
            break;

        // =========================================================
        // PEDIDOS
        // =========================================================
        case 'getOrders':
            $authUser = requireAuth();

            // Admin vê todos, usuário comum vê apenas os seus
            if ($authUser['role'] === 'ADMIN' || in_array('admin_panel', $authUser['permissions'] ?? [])) {
                $stmt = $conn->query("SELECT * FROM orders ORDER BY date DESC");
            } else {
                $stmt = $conn->prepare("SELECT * FROM orders WHERE userId = :userId ORDER BY date DESC");
                $stmt->execute([':userId' => $authUser['userId']]);
            }

            $orders = $stmt->fetchAll();
            foreach($orders as &$order) {
                $order['items'] = json_decode($order['items'] ?? '[]');
                $order['total'] = (float)$order['total'];
            }
            jsonResponse($orders);
            break;

        case 'createOrder':
            $authUser = requireAuth();

            if (empty($input['id']) || empty($input['items']) || !is_array($input['items'])) {
                http_response_code(400);
                jsonResponse(["error" => "Dados do pedido incompletos."]);
            }

            $sql = "INSERT INTO orders (id, userId, userStoreName, clientName, resellerClientId, paymentMethod, observations, total, totalDiscount, orderDiscountPercent, status, items, date)
                    VALUES (:id, :userId, :userStoreName, :clientName, :resellerClientId, :paymentMethod, :observations, :total, :totalDiscount, :orderDiscountPercent, :status, :items, :date)";
            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ':id' => $input['id'],
                ':userId' => $input['userId'],
                ':userStoreName' => sanitizeString($input['userStoreName'] ?? ''),
                ':clientName' => sanitizeString($input['clientName'] ?? ''),
                ':resellerClientId' => $input['resellerClientId'] ?? null,
                ':paymentMethod' => sanitizeString($input['paymentMethod'] ?? ''),
                ':observations' => sanitizeString($input['observations'] ?? ''),
                ':total' => (float)($input['total'] ?? 0),
                ':totalDiscount' => (float)($input['totalDiscount'] ?? 0),
                ':orderDiscountPercent' => (float)($input['orderDiscountPercent'] ?? 0),
                ':status' => $input['status'] ?? 'ANALYSIS',
                ':items' => json_encode($input['items']),
                ':date' => $input['date'] ?? date('c')
            ]);

            auditLog($conn, $authUser['userId'], $authUser['storeName'] ?? '', 'CREATE_ORDER', 'orders', $input['id'], "Total: R$ " . number_format($input['total'] ?? 0, 2, ',', '.'));

            jsonResponse($input);
            break;

        case 'updateOrder':
            $authUser = requireAuth();

            // Apenas admin pode alterar status
            if ($authUser['role'] !== 'ADMIN' && !in_array('admin_panel', $authUser['permissions'] ?? [])) {
                http_response_code(403);
                jsonResponse(["error" => "Sem permissão para alterar pedidos."]);
            }

            if (empty($input['id']) || empty($input['status'])) {
                http_response_code(400);
                jsonResponse(["error" => "ID e status são obrigatórios."]);
            }

            $validStatuses = ['ANALYSIS', 'APPROVED', 'PENDING', 'SHIPPED', 'COMPLETED', 'CANCELED'];
            if (!in_array($input['status'], $validStatuses)) {
                http_response_code(400);
                jsonResponse(["error" => "Status inválido."]);
            }

            $stmt = $conn->prepare("UPDATE orders SET status = :status WHERE id = :id");
            $stmt->execute([':status' => $input['status'], ':id' => $input['id']]);

            $getObj = $conn->prepare("SELECT * FROM orders WHERE id = :id");
            $getObj->execute([':id' => $input['id']]);
            $updated = $getObj->fetch();
            if($updated) $updated['items'] = json_decode($updated['items']);

            auditLog($conn, $authUser['userId'], $authUser['storeName'] ?? '', 'UPDATE_ORDER_STATUS', 'orders', $input['id'], "Novo status: " . $input['status']);

            jsonResponse($updated);
            break;

        case 'deleteOrder':
            $authUser = requireAuth();
            if ($authUser['role'] !== 'ADMIN') {
                http_response_code(403);
                jsonResponse(["error" => "Sem permissão."]);
            }
            if (empty($input['id'])) {
                http_response_code(400);
                jsonResponse(["error" => "ID obrigatório."]);
            }
            $stmt = $conn->prepare("DELETE FROM orders WHERE id = :id");
            $stmt->execute([':id' => $input['id']]);
            auditLog($conn, $authUser['userId'], $authUser['storeName'] ?? '', 'DELETE_ORDER', 'orders', $input['id']);
            jsonResponse(["success" => true]);
            break;

        // =========================================================
        // CONFIGURAÇÕES
        // =========================================================
        case 'getSettings':
            // Settings é acessível para todos os logados
            requireAuth();

            $stmt = $conn->query("SELECT * FROM settings WHERE id = 1");
            $settings = $stmt->fetch();
            if (!$settings) {
                jsonResponse([
                    'primaryColor' => '#fc5200',
                    'secondaryColor' => '#1e293b',
                    'companyName' => 'MWE',
                    'logoUrl' => '',
                    'faviconUrl' => '',
                    'footerText' => 'MWE Distribuidora © 2026 - Catálogo Online'
                ]);
            }
            if (isset($settings['paymentPoliciesJson']) && $settings['paymentPoliciesJson']) {
                $settings['paymentPolicies'] = json_decode($settings['paymentPoliciesJson'], true) ?: [];
            } else {
                $settings['paymentPolicies'] = [];
            }
            unset($settings['paymentPoliciesJson']);
            jsonResponse($settings);
            break;

        case 'saveSettings':
            $authUser = requireAuth();
            if ($authUser['role'] !== 'ADMIN') {
                http_response_code(403);
                jsonResponse(["error" => "Apenas administradores podem alterar configurações."]);
            }

            $cols = [
                'primaryColor', 'secondaryColor', 'companyName', 'footerText',
                'logoUrl', 'faviconUrl', 'supportEmail', 'supportPhone',
                'instagramUrl', 'linkedinUrl', 'facebookUrl', 'youtubeUrl', 'tiktokUrl',
                'websiteUrl', 'customAddress', 'promoBannerUrl'
            ];

            $check = $conn->query("SELECT count(*) FROM settings WHERE id=1")->fetchColumn();
            if ($check == 0) {
                 $conn->exec("INSERT INTO settings (id) VALUES (1)");
            }

            $paymentPoliciesJson = null;
            if (isset($input['paymentPolicies']) && is_array($input['paymentPolicies'])) {
                $paymentPoliciesJson = json_encode($input['paymentPolicies'], JSON_UNESCAPED_UNICODE);
            }

            $sets = [];
            $params = [':id' => 1];

            foreach($cols as $col) {
                $sets[] = "$col = :$col";
                $params[":$col"] = $input[$col] ?? '';
            }

            $sets[] = "paymentPoliciesJson = :paymentPoliciesJson";
            $params[':paymentPoliciesJson'] = $paymentPoliciesJson;

            $sql = "UPDATE settings SET " . implode(', ', $sets) . " WHERE id = :id";

            $stmt = $conn->prepare($sql);
            $stmt->execute($params);

            auditLog($conn, $authUser['userId'], $authUser['storeName'] ?? '', 'UPDATE_SETTINGS', 'settings', '1');

            jsonResponse($input);
            break;

        // =========================================================
        // SESSÃO
        // =========================================================
        case 'checkUserSession':
            $userId = $_GET['id'] ?? '';
            if (empty($userId)) {
                jsonResponse(["valid" => false, "status" => "MISSING_ID"]);
            }
            $stmt = $conn->prepare("SELECT status FROM users WHERE id = :id");
            $stmt->execute([':id' => $userId]);
            $row = $stmt->fetch();
            if ($row && $row['status'] === 'APPROVED') {
                jsonResponse(["valid" => true, "status" => $row['status']]);
            } else {
                jsonResponse(["valid" => false, "status" => $row['status'] ?? 'NOT_FOUND']);
            }
            break;

        case 'checkStatus':
            try {
                $tables = [];
                $res = $conn->query("SHOW TABLES");
                while($row = $res->fetch(PDO::FETCH_NUM)) { $tables[] = $row[0]; }

                jsonResponse([
                    'status' => 'ok',
                    'message' => 'API B2B MWE v2.0 - Conexão OK',
                    'tables' => $tables
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                jsonResponse(['status' => 'error', 'message' => 'Erro de conexão']);
            }
            break;

        // =========================================================
        // UPLOAD DE IMAGENS
        // =========================================================
        case 'uploadImage':
            $authUser = requireAuth();

            if (!isset($_FILES['file'])) {
                http_response_code(400);
                jsonResponse(["error" => "Nenhum arquivo enviado."]);
            }

            $file = $_FILES['file'];
            $maxSize = (int)(getenv('MAX_UPLOAD_SIZE') ?: 5242880); // 5MB default
            $allowedExtensions = array_map('trim', explode(',', getenv('ALLOWED_EXTENSIONS') ?: 'jpg,jpeg,png,gif,webp'));

            // Validar tamanho
            if ($file['size'] > $maxSize) {
                http_response_code(413);
                jsonResponse(["error" => "Arquivo muito grande. Máximo: " . round($maxSize / 1048576, 1) . "MB."]);
            }

            // Validar extensão
            $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            if (!in_array($extension, $allowedExtensions)) {
                http_response_code(400);
                jsonResponse(["error" => "Tipo de arquivo não permitido. Permitidos: " . implode(', ', $allowedExtensions)]);
            }

            // Validar MIME type real
            $finfo = new finfo(FILEINFO_MIME_TYPE);
            $mimeType = $finfo->file($file['tmp_name']);
            $allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!in_array($mimeType, $allowedMimes)) {
                http_response_code(400);
                jsonResponse(["error" => "Tipo MIME de arquivo inválido."]);
            }

            // Validar erros de upload
            if ($file['error'] !== UPLOAD_ERR_OK) {
                http_response_code(500);
                jsonResponse(["error" => "Erro no upload: código " . $file['error']]);
            }

            $target_dir = "uploads/";
            if (!file_exists($target_dir)) { mkdir($target_dir, 0755, true); }

            // Nome seguro e único
            $new_name = bin2hex(random_bytes(16)) . "." . $extension;
            $target_file = $target_dir . $new_name;

            if (move_uploaded_file($file['tmp_name'], $target_file)) {
                $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
                $baseUrl = $protocol . "://" . $_SERVER['HTTP_HOST'] . dirname($_SERVER['PHP_SELF']);
                $baseUrl = rtrim($baseUrl, '/\\');

                auditLog($conn, $authUser['userId'], $authUser['storeName'] ?? '', 'UPLOAD_IMAGE', 'uploads', $new_name, "Size: " . $file['size']);

                jsonResponse($baseUrl . '/' . $target_file);
            } else {
                http_response_code(500);
                jsonResponse(["error" => "Falha ao salvar arquivo."]);
            }
            break;

        // =========================================================
        // CLIENTES DO REVENDEDOR
        // =========================================================
        case 'getResellerClients':
            $authUser = requireAuth();
            $resellerId = $_GET['resellerId'] ?? '';

            // Pode ver apenas os próprios clientes (exceto admin que vê todos)
            if ($authUser['role'] !== 'ADMIN' && $authUser['userId'] !== $resellerId) {
                http_response_code(403);
                jsonResponse(["error" => "Sem permissão."]);
            }

            $stmt = $conn->prepare("SELECT * FROM reseller_clients WHERE resellerId = :resellerId ORDER BY companyName");
            $stmt->execute([':resellerId' => $resellerId]);
            jsonResponse($stmt->fetchAll());
            break;

        case 'getAllResellerClients':
            $authUser = requireAuth();
            if ($authUser['role'] !== 'ADMIN' && !in_array('admin_panel', $authUser['permissions'] ?? [])) {
                http_response_code(403);
                jsonResponse(["error" => "Sem permissão."]);
            }
            $stmt = $conn->query("SELECT * FROM reseller_clients ORDER BY companyName");
            jsonResponse($stmt->fetchAll());
            break;

        case 'saveResellerClient':
            $authUser = requireAuth();

            // Apenas o dono ou admin pode salvar
            if ($authUser['role'] !== 'ADMIN' && $authUser['userId'] !== ($input['resellerId'] ?? '')) {
                http_response_code(403);
                jsonResponse(["error" => "Sem permissão."]);
            }

            // Validar se linkedUserId já está vinculado a outro revendedor
            if (!empty($input['linkedUserId'])) {
                $checkStmt = $conn->prepare("SELECT id, resellerId FROM reseller_clients WHERE linkedUserId = :linkedUserId AND resellerId != :resellerId AND id != :currentId LIMIT 1");
                $checkStmt->execute([
                    ':linkedUserId' => $input['linkedUserId'],
                    ':resellerId' => $input['resellerId'],
                    ':currentId' => $input['id'] ?? ''
                ]);
                $existing = $checkStmt->fetch();
                if ($existing) {
                    http_response_code(409);
                    jsonResponse(["error" => "Este lojista já está vinculado a outro revendedor."]);
                }
            }

            $sql = "REPLACE INTO reseller_clients (id, resellerId, linkedUserId, companyName, tradeName, cnpj, phone, email, notes, status, createdAt)
                    VALUES (:id, :resellerId, :linkedUserId, :companyName, :tradeName, :cnpj, :phone, :email, :notes, :status, :createdAt)";
            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ':id' => $input['id'],
                ':resellerId' => $input['resellerId'],
                ':linkedUserId' => $input['linkedUserId'] ?? null,
                ':companyName' => sanitizeString($input['companyName'] ?? ''),
                ':tradeName' => sanitizeString($input['tradeName'] ?? ''),
                ':cnpj' => sanitizeString($input['cnpj'] ?? ''),
                ':phone' => sanitizeString($input['phone'] ?? ''),
                ':email' => strtolower(trim($input['email'] ?? '')),
                ':notes' => $input['notes'] ?? '',
                ':status' => $input['status'] ?? 'ACTIVE',
                ':createdAt' => $input['createdAt'] ?? date('Y-m-d H:i:s')
            ]);

            auditLog($conn, $authUser['userId'], $authUser['storeName'] ?? '', 'SAVE_RESELLER_CLIENT', 'reseller_clients', $input['id']);
            jsonResponse($input);
            break;

        case 'deleteResellerClient':
            $authUser = requireAuth();
            $id = $_GET['id'] ?? '';
            if (empty($id)) {
                http_response_code(400);
                jsonResponse(["error" => "ID obrigatório."]);
            }

            // Verificar permissão
            if ($authUser['role'] !== 'ADMIN') {
                $checkStmt = $conn->prepare("SELECT resellerId FROM reseller_clients WHERE id = :id");
                $checkStmt->execute([':id' => $id]);
                $client = $checkStmt->fetch();
                if (!$client || $client['resellerId'] !== $authUser['userId']) {
                    http_response_code(403);
                    jsonResponse(["error" => "Sem permissão."]);
                }
            }

            $stmt = $conn->prepare("DELETE FROM reseller_clients WHERE id = :id");
            $stmt->execute([':id' => $id]);
            auditLog($conn, $authUser['userId'], $authUser['storeName'] ?? '', 'DELETE_RESELLER_CLIENT', 'reseller_clients', $id);
            jsonResponse(["success" => true]);
            break;

        // =========================================================
        // AUDIT LOGS
        // =========================================================
        case 'getAuditLogs':
            $authUser = requireAuth();
            if ($authUser['role'] !== 'ADMIN') {
                http_response_code(403);
                jsonResponse(["error" => "Apenas administradores podem ver logs."]);
            }

            $page = max(1, (int)($_GET['page'] ?? 1));
            $limit = min(100, max(10, (int)($_GET['limit'] ?? 50)));
            $offset = ($page - 1) * $limit;

            $total = $conn->query("SELECT COUNT(*) FROM audit_logs")->fetchColumn();

            $stmt = $conn->prepare("SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT :limit OFFSET :offset");
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();

            jsonResponse([
                "data" => $stmt->fetchAll(),
                "total" => (int)$total,
                "page" => $page,
                "totalPages" => ceil($total / $limit)
            ]);
            break;

        // =========================================================
        // PASSWORD RESET ADMIN (admin gera token para o usuário)
        // =========================================================
        case 'adminGenerateResetToken':
            $authUser = requireAuth();
            if ($authUser['role'] !== 'ADMIN') {
                http_response_code(403);
                jsonResponse(["error" => "Sem permissão."]);
            }

            $email = strtolower(trim($input['email'] ?? ''));
            if (!validateEmail($email)) {
                http_response_code(400);
                jsonResponse(["error" => "E-mail inválido."]);
            }

            $conn->exec("CREATE TABLE IF NOT EXISTS password_resets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(100) NOT NULL,
                token VARCHAR(64) NOT NULL UNIQUE,
                expiresAt DATETIME NOT NULL,
                used TINYINT(1) DEFAULT 0,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            $token = bin2hex(random_bytes(32));
            $expiresAt = date('Y-m-d H:i:s', strtotime('+24 hours'));

            $conn->prepare("UPDATE password_resets SET used = 1 WHERE email = :email")->execute([':email' => $email]);
            $conn->prepare("INSERT INTO password_resets (email, token, expiresAt) VALUES (:email, :token, :expiresAt)")->execute([
                ':email' => $email, ':token' => $token, ':expiresAt' => $expiresAt
            ]);

            auditLog($conn, $authUser['userId'], $authUser['storeName'] ?? '', 'ADMIN_GENERATE_RESET', 'users', null, "Para: $email");

            jsonResponse(["success" => true, "token" => $token, "expiresAt" => $expiresAt]);
            break;

        // =========================================================
        // DEFAULT
        // =========================================================
        default:
            jsonResponse(["status" => "online", "message" => "API B2B MWE v2.0", "version" => "2.0.0"]);
            break;
    }

} catch (Exception $e) {
    http_response_code(500);
    // Em produção, não expor mensagem de erro detalhada
    $errorMsg = getenv('APP_ENV') === 'production' ? 'Erro interno do servidor.' : $e->getMessage();
    echo json_encode(["error" => "Erro interno: " . $errorMsg]);
}

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================
function mapProduct($p) {
    return [
        'id' => $p['id'],
        'internalCode' => $p['internalCode'] ?? '',
        'parallelCodes' => $p['parallelCodes'] ?? '',
        'name' => $p['name'] ?? '',
        'description' => $p['description'] ?? '',
        'manufacturer' => $p['manufacturer'] ?? '',
        'vehicle' => $p['vehicle'] ?? '',
        'application' => $p['application'] ?? '',
        'kitComponents' => $p['kitComponents'] ?? '',
        'group' => $p['group_name'] ?? '',
        'position' => $p['position'] ?? '',
        'price' => (float)($p['price'] ?? 0),
        'promo_price' => (float)($p['promo_price'] ?? 0),
        'min_stock_display' => $p['min_stock_display'] ?? null,
        'images' => json_decode($p['images'] ?? '[]'),
        'stock' => (int)($p['stock'] ?? 0),
        'active' => (bool)($p['active'] ?? false),
        'compatibility' => json_decode($p['compatibility_json'] ?? '[]', true) ?: []
    ];
}
?>
