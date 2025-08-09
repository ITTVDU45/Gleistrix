declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | [number, number, number, number];
    filename?: string;
    image?: {
      type?: string;
      quality?: number;
    };
    enableLinks?: boolean;
    html2canvas?: {
      scale?: number;
      useCORS?: boolean;
      allowTaint?: boolean;
    };
    jsPDF?: {
      orientation?: 'portrait' | 'landscape';
      unit?: 'pt' | 'mm' | 'cm' | 'in';
      format?: string | [number, number];
    };
  }

  interface Html2PdfInstance {
    set(options: Html2PdfOptions): Html2PdfInstance;
    from(element: HTMLElement): Html2PdfInstance;
    toPdf(): Promise<void>;
    toContainer(): Html2PdfInstance;
    toImg(): Html2PdfInstance;
    toCanvas(): Html2PdfInstance;
    toJpeg(): Html2PdfInstance;
    toPng(): Html2PdfInstance;
    toSvg(): Html2PdfInstance;
    save(): Promise<void>;
    outputPdf(): Promise<Uint8Array>;
    outputImg(): Promise<string>;
    outputCanvas(): Promise<HTMLCanvasElement>;
  }

  function html2pdf(): Html2PdfInstance;
  function html2pdf(element: HTMLElement, options?: Html2PdfOptions): Html2PdfInstance;
  function html2pdf(options?: Html2PdfOptions): Html2PdfInstance;

  export = html2pdf;
} 