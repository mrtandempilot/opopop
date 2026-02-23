// Polyfills for pdfjs-dist and other browser-like libraries
if (typeof (global as any).DOMMatrix === "undefined") {
    (global as any).DOMMatrix = class DOMMatrix {
        constructor() { }
    };
}
if (typeof (global as any).ImageData === "undefined") {
    (global as any).ImageData = class ImageData {
        constructor() { }
    };
}
if (typeof (global as any).Path2D === "undefined") {
    (global as any).Path2D = class Path2D {
        constructor() { }
    };
}

console.log("[polyfills] Global polyfills applied.");
export { };
