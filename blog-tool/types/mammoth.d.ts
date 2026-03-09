declare module "mammoth" {
    interface ExtractResult {
        value: string;
        messages: Array<{ type: string; message: string }>;
    }

    interface Options {
        buffer?: Buffer | ArrayBuffer;
        path?: string;
    }

    export function extractRawText(options: Options): Promise<ExtractResult>;
    export function convertToHtml(options: Options): Promise<ExtractResult>;
}
