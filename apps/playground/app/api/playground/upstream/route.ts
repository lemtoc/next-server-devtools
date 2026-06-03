export const dynamic = "force-dynamic";

export const GET = (request: Request) => {
  const url = new URL(request.url);

  return Response.json({
    message: "Hello from the playground upstream route.",
    query: url.searchParams.get("query"),
    receivedAuthorization: request.headers.has("authorization"),
    serverTime: new Date().toISOString(),
  });
};
