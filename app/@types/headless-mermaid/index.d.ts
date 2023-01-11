declare module 'headless-mermaid' {
    export function execute(code: string, config? : {}, script?: string, diagramId?: string) : Promise<string>;
}