declare namespace Deno {
    function serve(handler: (request: Request) => Response | Promise<Response>): unknown;
    const env: { get(name: string): string | undefined };
}
