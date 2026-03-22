import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
    children: ReactNode;
    scope?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
    public state: State;

    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null
        };
    }

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-4 my-4">
                    <div className="p-3 bg-red-100 rounded-xl text-red-600">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-red-900 mb-1">
                            Ops! Ocorreu um erro ao exibir {this.props.scope || 'este conteúdo'}.
                        </h3>
                        <p className="text-sm font-bold text-red-700 mb-2">
                            Isso geralmente acontece por dados inválidos em algum produto.
                        </p>
                        <p className="text-xs font-mono bg-red-100 p-2 rounded text-red-800 break-all">
                            {this.state.error?.message}
                        </p>
                        <button
                            onClick={() => this.setState({ hasError: false })}
                            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700"
                        >
                            Tentar Novamente
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
