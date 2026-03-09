declare module "pdf-parse" {
    interface PdfData {
        numpages: number;
        numrender: number;
        info: Record<string, unknown>;
        metadata: Record<string, unknown> | null;
        version: string;
        text: string;
    }

    interface PdfOptions {
        pagerender?: (pageData: unknown) => string;
        max?: number;
        version?: string;
    }

    function pdfParse(
        dataBuffer: Buffer | ArrayBuffer,
        options?: PdfOptions
    ): Promise<PdfData>;

    export = pdfParse;
}
