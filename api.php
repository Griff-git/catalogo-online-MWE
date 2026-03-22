<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS, DELETE, PUT");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit;
}

$host = "localhost";
$db_name = "u608788898_catalogo";
$username = "u608788898_mweuser";
$password = "Mw3_D15tr1BuiD0r@*";

try {
    $conn = new PDO("mysql:host=" . $host . ";dbname=" . $db_name . ";charset=utf8", $username, $password);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Conexão falhou: " . $e->getMessage()]);
    exit;
}

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents("php://input"), true);

// Helper para responder JSON
function jsonResponse($data) {
    echo json_encode($data);
    exit;
}

try {
    switch($action) {
        // --- PRODUTOS ---
        case 'getProducts':
            $stmt = $conn->query("SELECT * FROM products");
            $products = $stmt->fetchAll(PDO::FETCH_ASSOC);
            // Converter campos JSON/Texto para array/booleans
            foreach($products as &$p) {
                $p['price'] = (float)$p['price'];
                $p['promo_price'] = (float)($p['promo_price'] ?? 0);
                $p['stock'] = (int)$p['stock'];
                $p['active'] = (bool)$p['active'];
                $p['images'] = json_decode($p['images'] ?? '[]');
                // Map DB names to frontend names
                $p['group'] = $p['group_name'];
                $p['position'] = $p['position'];
                $p['min_stock_display'] = $p['min_stock_display']; 
                // Decode compatibility data
                $p['compatibility'] = json_decode($p['compatibility_json'] ?? '[]', true) ?: [];
                
                unset($p['group_name']); // Clean raw
                unset($p['compatibility_json']); // Clean raw
            }
            jsonResponse($products);
            break;

        case 'saveProduct':
            // Ensure compatibility is encoded, default to empty array '[]' if missing
            $compatibilityJson = !empty($input['compatibility']) ? json_encode($input['compatibility'], JSON_UNESCAPED_UNICODE) : '[]';

            $sql = "REPLACE INTO products (id, internalCode, parallelCodes, name, description, manufacturer, vehicle, compatibility_json, application, kitComponents, group_name, position, price, promo_price, min_stock_display, images, stock, active) 
                    VALUES (:id, :internalCode, :parallelCodes, :name, :description, :manufacturer, :vehicle, :compatibility_json, :application, :kitComponents, :group_name, :position, :price, :promo_price, :min_stock_display, :images, :stock, :active)";
            $stmt = $conn->prepare($sql);
            
            // Tratamento de dados
            $input['images'] = json_encode($input['images'] ?? []);
            $input['active'] = $input['active'] ? 1 : 0;
            // Frontend manda 'group' e 'position', mas banco usa 'group_name' e 'position'
            // DB mapping
            $input['group_name'] = $input['group'] ?? '';
            $input['position'] = $input['position'] ?? '';
            
            // Remove chaves que não existem no bind se necessário, mas PDO ignora extras se não fizermos bind manual de tudo?
            // Melhor montar params explicitos no saveProductsBulk. Aqui no REPLACE simples, vamos confiar que o input bata ou ajustamos.
            // Para segurança, vamos fazer bind manual igual no bulk.
            
            $params = [
                ':id' => $input['id'],
                ':internalCode' => $input['internalCode'],
                ':parallelCodes' => $input['parallelCodes'],
                ':name' => $input['name'],
                ':description' => $input['description'],
                ':manufacturer' => $input['manufacturer'] ?? '',
                ':vehicle' => $input['vehicle'] ?? '',
                ':compatibility_json' => $compatibilityJson,
                ':application' => $input['application'],
                ':kitComponents' => $input['kitComponents'],
                ':group_name' => $input['group_name'],
                ':position' => $input['position'],
                ':price' => (float)($input['price'] ?? 0),
                ':promo_price' => (float)($input['promo_price'] ?? 0),
                ':min_stock_display' => $input['min_stock_display'] ?? null,
                ':images' => $input['images'],
                ':stock' => $input['stock'],
                ':active' => $input['active']
            ];
            
            $stmt->execute($params);
            jsonResponse($input); 
            break;

        case 'saveProductsBulk':
            try {
                // Configurações para upload pesado
                ini_set('memory_limit', '256M');
                set_time_limit(300); // 5 minutos

                $conn->beginTransaction();
                
                // Verifica flag de limpeza (para upload fragmentado)
                $shouldClean = filter_var($_GET['clean'] ?? 'true', FILTER_VALIDATE_BOOLEAN);

                if ($shouldClean) {
                    $conn->exec("DELETE FROM products");
                }
                
                $sql = "INSERT INTO products (id, internalCode, parallelCodes, name, description, manufacturer, vehicle, compatibility_json, application, kitComponents, group_name, position, price, promo_price, min_stock_display, images, stock, active) 
                        VALUES (:id, :internalCode, :parallelCodes, :name, :description, :manufacturer, :vehicle, :compatibility_json, :application, :kitComponents, :group_name, :position, :price, :promo_price, :min_stock_display, :images, :stock, :active)";
                $stmt = $conn->prepare($sql);
                
                foreach ($input as $product) {
                    $product['images'] = json_encode($product['images'] ?? []);
                    $product['active'] = $product['active'] ? 1 : 0;
                    
                    $compatibilityJson = isset($product['compatibility']) ? json_encode($product['compatibility'], JSON_UNESCAPED_UNICODE) : null;

                    $params = [
                        ':id' => $product['id'],
                        ':internalCode' => $product['internalCode'],
                        ':parallelCodes' => $product['parallelCodes'],
                        ':name' => $product['name'],
                        ':description' => $product['description'],
                        ':manufacturer' => $product['manufacturer'] ?? '',
                        ':vehicle' => $product['vehicle'] ?? '',
                        ':compatibility_json' => $compatibilityJson, // New field
                        ':application' => $product['application'],
                        ':kitComponents' => $product['kitComponents'],
                        ':group_name' => $product['group'] ?? '', // Frontend manda 'group'
                        ':position' => $product['position'] ?? '',
                        ':price' => (float)($product['price'] ?? 0),
                        ':promo_price' => (float)($product['promo_price'] ?? 0),
                        ':min_stock_display' => $product['min_stock_display'] ?? null,
                        ':images' => $product['images'],
                        ':stock' => $product['stock'],
                        ':active' => $product['active']
                    ];
                    $stmt->execute($params);
                }
                
                $conn->commit();
                jsonResponse(["success" => true, "count" => count($input)]);
            } catch (Exception $e) {
                $conn->rollBack();
                http_response_code(500);
                echo json_encode(["error" => "Erro no upload em massa: " . $e->getMessage()]);
            }
            break;

        case 'deleteProduct':
            $id = $_GET['id'] ?? '';
            $stmt = $conn->prepare("DELETE FROM products WHERE id = :id");
            $stmt->execute([':id' => $id]);
            jsonResponse(["success" => true]);
            break;

        // --- USUÁRIOS ---
        case 'getUsers':
            $stmt = $conn->query("SELECT id, storeName, responsibleName, cnpj, phone, email, password, role, status, createdAt, permissions FROM users");
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach($users as &$u) {
                $u['permissions'] = json_decode($u['permissions'] ?? '[]', true) ?: [];
            }
            jsonResponse($users);
            break;

        case 'saveUser':
            // Se password não vier, manter o atual
            if (empty($input['password'])) {
               $currApi = $conn->prepare("SELECT password FROM users WHERE id = :id");
               $currApi->execute([':id' => $input['id']]);
               $curr = $currApi->fetch(PDO::FETCH_ASSOC);
               $input['password'] = $curr['password'] ?? ''; 
            }

            // Auto-migração: adicionar coluna permissions se não existir
            try {
                $conn->exec("ALTER TABLE users ADD COLUMN permissions TEXT DEFAULT NULL");
            } catch (PDOException $e) { /* já existe */ }

            // Serializar permissions para JSON
            $permissionsJson = !empty($input['permissions']) ? json_encode($input['permissions'], JSON_UNESCAPED_UNICODE) : null;

            // Auto-migração: adicionar coluna lastLogin se não existir
            try {
                $conn->exec("ALTER TABLE users ADD COLUMN lastLogin DATETIME DEFAULT NULL");
            } catch (PDOException $e) { /* já existe */ }

            $sql = "REPLACE INTO users (id, storeName, responsibleName, cnpj, phone, email, password, role, status, createdAt, permissions, lastLogin) 
                    VALUES (:id, :storeName, :responsibleName, :cnpj, :phone, :email, :password, :role, :status, :createdAt, :permissions, :lastLogin)";
            $stmt = $conn->prepare($sql);
            $params = [
                ':id' => $input['id'],
                ':storeName' => $input['storeName'],
                ':responsibleName' => $input['responsibleName'],
                ':cnpj' => $input['cnpj'],
                ':phone' => $input['phone'],
                ':email' => $input['email'],
                ':password' => $input['password'],
                ':role' => $input['role'],
                ':status' => $input['status'],
                ':createdAt' => $input['createdAt'],
                ':permissions' => $permissionsJson,
                ':lastLogin' => $input['lastLogin'] ?? null
            ];
            $stmt->execute($params);
            // Retornar com permissions como array
            $input['permissions'] = $input['permissions'] ?? [];
            jsonResponse($input);
            break;

        // --- PEDIDOS ---
        case 'getOrders':
            $stmt = $conn->query("SELECT * FROM orders ORDER BY date DESC");
            $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach($orders as &$order) { 
                $order['items'] = json_decode($order['items'] ?? '[]'); 
                $order['total'] = (float)$order['total'];
            }
            jsonResponse($orders);
            break;

        case 'createOrder':
            // Auto-migração: adicionar coluna clientName se não existir
            try {
                $conn->exec("ALTER TABLE orders ADD COLUMN clientName VARCHAR(255) DEFAULT NULL AFTER userStoreName");
            } catch (PDOException $e) { /* já existe */ }

            // Auto-migração: adicionar coluna paymentMethod se não existir
            try {
                $conn->exec("ALTER TABLE orders ADD COLUMN paymentMethod VARCHAR(255) DEFAULT NULL AFTER clientName");
            } catch (PDOException $e) { /* já existe */ }

            // Auto-migração: adicionar coluna observations se não existir
            try {
                $conn->exec("ALTER TABLE orders ADD COLUMN observations TEXT DEFAULT NULL AFTER paymentMethod");
            } catch (PDOException $e) { /* já existe */ }

            // Auto-migração: adicionar coluna resellerClientId se não existir
            try {
                $conn->exec("ALTER TABLE orders ADD COLUMN resellerClientId VARCHAR(36) DEFAULT NULL AFTER clientName");
            } catch (PDOException $e) { /* já existe */ }

            // Auto-migração: adicionar colunas de desconto se não existirem
            try {
                $conn->exec("ALTER TABLE orders ADD COLUMN totalDiscount DECIMAL(12,2) DEFAULT 0 AFTER total");
            } catch (PDOException $e) { /* já existe */ }
            try {
                $conn->exec("ALTER TABLE orders ADD COLUMN orderDiscountPercent DECIMAL(5,2) DEFAULT 0 AFTER totalDiscount");
            } catch (PDOException $e) { /* já existe */ }

            $sql = "INSERT INTO orders (id, userId, userStoreName, clientName, resellerClientId, paymentMethod, observations, total, totalDiscount, orderDiscountPercent, status, items, date) VALUES (:id, :userId, :userStoreName, :clientName, :resellerClientId, :paymentMethod, :observations, :total, :totalDiscount, :orderDiscountPercent, :status, :items, :date)";
            $stmt = $conn->prepare($sql);
            $input['items'] = json_encode($input['items']);
            $input['clientName'] = $input['clientName'] ?? null;
            $input['resellerClientId'] = $input['resellerClientId'] ?? null;
            $input['paymentMethod'] = $input['paymentMethod'] ?? null;
            $input['observations'] = $input['observations'] ?? null;
            $input['totalDiscount'] = $input['totalDiscount'] ?? 0;
            $input['orderDiscountPercent'] = $input['orderDiscountPercent'] ?? 0;
            $stmt->execute($input);
            jsonResponse($input);
            break;
            
        case 'updateOrder':
            $sql = "UPDATE orders SET status = :status WHERE id = :id";
            $stmt = $conn->prepare($sql);
            $stmt->execute([':status' => $input['status'], ':id' => $input['id']]);
            // Retorna o pedido completo? O frontend espera o objeto.
            // Vamos buscar e retornar
            $getObj = $conn->prepare("SELECT * FROM orders WHERE id = :id");
            $getObj->execute([':id' => $input['id']]);
            $updated = $getObj->fetch(PDO::FETCH_ASSOC);
            if($updated) $updated['items'] = json_decode($updated['items']);
            jsonResponse($updated);
            break;

        // --- CONFIGURAÇÕES ---
        case 'getSettings':
            $stmt = $conn->query("SELECT * FROM settings WHERE id = 1"); // Assumindo tabela settings com id 1 único
            $settings = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$settings) {
                // Return default if not found (db might be empty)
                jsonResponse([
                    'primaryColor' => '#fc5200',
                    'secondaryColor' => '#1e293b',
                    'companyName' => 'MWE',
                    'logoUrl' => 'https://mwedistribuidora.com.br/wp-content/uploads/2024/03/mwe-preto.png',
                    'faviconUrl' => '',
                    'footerText' => 'MWE Distribuidora © 2026 - Catálogo Online'
                ]);
            }
            // Decode paymentPoliciesJson if present
            if (isset($settings['paymentPoliciesJson']) && $settings['paymentPoliciesJson']) {
                $settings['paymentPolicies'] = json_decode($settings['paymentPoliciesJson'], true) ?: [];
            } else {
                $settings['paymentPolicies'] = [];
            }
            unset($settings['paymentPoliciesJson']);
            jsonResponse($settings);
            break;

        case 'saveSettings':
            // Log para debug
            // file_put_contents('debug_settings.log', print_r($input, true));

            $cols = [
                'primaryColor', 'secondaryColor', 'companyName', 'footerText', 
                'logoUrl', 'faviconUrl', 'supportEmail', 'supportPhone', 
                'instagramUrl', 'linkedinUrl', 'facebookUrl', 'youtubeUrl', 'tiktokUrl',
                'websiteUrl', 'customAddress', 'promoBannerUrl'
            ];

            // Garante que o ID 1 exista antes de tentar update
            $check = $conn->query("SELECT count(*) FROM settings WHERE id=1")->fetchColumn();
            if ($check == 0) {
                 $conn->exec("INSERT INTO settings (id) VALUES (1)");
            }

            // AUTO-MIGRAÇÃO: Tenta adicionar colunas. Se já existirem, ignora o erro.
            // Isso é mais robusto que verificar schema em alguns ambientes.
            try {
                $conn->exec("ALTER TABLE settings ADD COLUMN websiteUrl VARCHAR(255) DEFAULT ''");
            } catch (PDOException $e) {
                // Column probably exists, ignore
            }
            try {
                $conn->exec("ALTER TABLE settings ADD COLUMN customAddress TEXT");
            } catch (PDOException $e) {
                // Column probably exists, ignore
            }
            try {
                $conn->exec("ALTER TABLE settings ADD COLUMN paymentPoliciesJson LONGTEXT");
            } catch (PDOException $e) {
                // Column probably exists, ignore
            }
            try {
                $conn->exec("ALTER TABLE settings ADD COLUMN promoBannerUrl VARCHAR(500) DEFAULT ''");
            } catch (PDOException $e) {
                // Column probably exists, ignore
            }

            // Handle paymentPolicies JSON encoding
            $paymentPoliciesJson = null;
            if (isset($input['paymentPolicies']) && is_array($input['paymentPolicies'])) {
                $paymentPoliciesJson = json_encode($input['paymentPolicies'], JSON_UNESCAPED_UNICODE);
            }

            $sets = [];
            $params = [':id' => 1];
            
            foreach($cols as $col) {
                $sets[] = "$col = :$col";
                // Usa coalesce para garantir que não seja null
                $val = $input[$col] ?? '';
                // Sanitização básica se necessário, mas PDO já protege SQL Injection
                $params[":$col"] = $val;
            }

            // Add paymentPoliciesJson to update
            $sets[] = "paymentPoliciesJson = :paymentPoliciesJson";
            $params[':paymentPoliciesJson'] = $paymentPoliciesJson;

            $sql = "UPDATE settings SET " . implode(', ', $sets) . " WHERE id = :id";
            
            try {
                $stmt = $conn->prepare($sql);
                $stmt->execute($params);
                jsonResponse($input);
            } catch (PDOException $e) {
                http_response_code(500);
                echo json_encode(['error' => 'Erro ao salvar configurações: ' . $e->getMessage()]);
                exit;
            }
            break;

        case 'checkUserSession':
            $userId = $_GET['id'] ?? '';
            if (empty($userId)) {
                jsonResponse(["valid" => false, "status" => "MISSING_ID"]);
            }
            $stmt = $conn->prepare("SELECT status FROM users WHERE id = :id");
            $stmt->execute([':id' => $userId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
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
                
                $settingsCount = -1;
                if (in_array('settings', $tables)) {
                    $settingsCount = $conn->query("SELECT count(*) FROM settings")->fetchColumn();
                }

                jsonResponse([
                    'status' => 'ok', 
                    'message' => 'Conexão com Banco de Dados OK',
                    'tables' => $tables,
                    'settings_row_count' => $settingsCount
                ]);
            } catch (Exception $e) {
                http_response_code(500);
                jsonResponse(['status' => 'error', 'message' => $e->getMessage()]);
            }
            break;

        // --- UPLOAD ---
        case 'uploadImage':
            if (isset($_FILES['file'])) {
                $target_dir = "uploads/";
                if (!file_exists($target_dir)) { mkdir($target_dir, 0777, true); }
                
                $extension = pathinfo($_FILES["file"]["name"], PATHINFO_EXTENSION);
                $new_name = uniqid() . "." . $extension;
                $target_file = $target_dir . $new_name;
                
                if (move_uploaded_file($_FILES["file"]["tmp_name"], $target_file)) {
                    // Retorna URL completa ou relativa? Relativa é melhor se estiver na mesma pasta.
                    // O frontend espera apenas a string da URL.
                    // Se o api.php está na raiz, uploads/ está na raiz.
                    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http";
                    $baseUrl = $protocol . "://" . $_SERVER['HTTP_HOST'] . dirname($_SERVER['PHP_SELF']);
                    // Correção de path se dirname retornar barra ou ponto
                    $baseUrl = rtrim($baseUrl, '/\\');
                    
                    jsonResponse($baseUrl . '/' . $target_file);
                } else {
                    http_response_code(500);
                    echo json_encode(["error" => "Falha no upload"]);
                }
            } else {
                http_response_code(400);
                echo json_encode(["error" => "Nenhum arquivo enviado"]);
            }
            break;

        default:
            jsonResponse(["status" => "online", "message" => "API B2B MWE rodando"]);
            break;

        case 'deleteOrder':
            $stmt = $conn->prepare("DELETE FROM orders WHERE id = :id");
            $stmt->execute([':id' => $input['id']]);
            jsonResponse(["success" => true]);
            break;

        // --- CLIENTES DO REVENDEDOR ---
        case 'getResellerClients':
            // Auto-criação da tabela reseller_clients
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
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )");
            $resellerId = $_GET['resellerId'] ?? '';
            $stmt = $conn->prepare("SELECT * FROM reseller_clients WHERE resellerId = :resellerId ORDER BY companyName");
            $stmt->execute([':resellerId' => $resellerId]);
            jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        case 'getAllResellerClients':
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
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )");
            $stmt = $conn->query("SELECT * FROM reseller_clients ORDER BY companyName");
            jsonResponse($stmt->fetchAll(PDO::FETCH_ASSOC));
            break;

        case 'saveResellerClient':
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
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )");
            $sql = "REPLACE INTO reseller_clients (id, resellerId, linkedUserId, companyName, tradeName, cnpj, phone, email, notes, status, createdAt)
                    VALUES (:id, :resellerId, :linkedUserId, :companyName, :tradeName, :cnpj, :phone, :email, :notes, :status, :createdAt)";
            $stmt = $conn->prepare($sql);
            $stmt->execute([
                ':id' => $input['id'],
                ':resellerId' => $input['resellerId'],
                ':linkedUserId' => $input['linkedUserId'] ?? null,
                ':companyName' => $input['companyName'],
                ':tradeName' => $input['tradeName'] ?? '',
                ':cnpj' => $input['cnpj'] ?? '',
                ':phone' => $input['phone'] ?? '',
                ':email' => $input['email'] ?? '',
                ':notes' => $input['notes'] ?? '',
                ':status' => $input['status'] ?? 'ACTIVE',
                ':createdAt' => $input['createdAt'] ?? date('Y-m-d H:i:s')
            ]);
            jsonResponse($input);
            break;

        case 'deleteResellerClient':
            $id = $_GET['id'] ?? '';
            $stmt = $conn->prepare("DELETE FROM reseller_clients WHERE id = :id");
            $stmt->execute([':id' => $id]);
            jsonResponse(["success" => true]);
            break;
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Erro interno: " . $e->getMessage()]);
}
?>
