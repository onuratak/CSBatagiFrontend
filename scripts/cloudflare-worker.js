export default {
  async fetch(request, env, ctx) {
    // IMPORTANT: Replace '*' with your frontend domain in production for security!
    const allowedOrigin = '*'; 
    // Example: const allowedOrigin = 'https://your-app.pages.dev'; 

    // Handle CORS preflight requests (sent by browsers before the actual POST)
    if (request.method === 'OPTIONS') {
      return handleOptions(request, allowedOrigin);
    }

    // --- Main POST request handling ---

    // 1. Check HTTP Method
    if (request.method !== 'POST') {
      return addCorsHeaders(new Response('Method Not Allowed', { status: 405 }), allowedOrigin);
    }

    // 2. Check Content-Type Header
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return addCorsHeaders(new Response('Unsupported Media Type: Expected application/json', { status: 415 }), allowedOrigin);
    }

    // 3. Get Secret API Token from Worker Environment Variables
    const apiToken = env.MATCHMAKING_TOKEN; // Make sure you set this secret in Cloudflare
    if (!apiToken) {
      console.error('MATCHMAKING_TOKEN secret not configured in Cloudflare Worker environment!');
      return addCorsHeaders(new Response('Internal Server Error: API token not configured', { status: 500 }), allowedOrigin);
    }

    try {
      // 4. Parse Incoming JSON Body
      const matchObject = await request.json();

      // 5. Define Upstream API URL
      const apiUrl = 'https://db2.csbatagi.com/start-match';

      // 6. Construct and Send Request to the Actual API
      const apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`, // Add the secret token here
          // Optional: Add a user-agent to identify requests from your worker
          'User-Agent': 'Cloudflare-Worker-Match-Proxy/1.0' 
        },
        body: JSON.stringify(matchObject), // Forward the parsed body
      });

      // --- DEBUGGING: Log the response from the upstream API ---
      const apiResponseBody = await apiResponse.clone().text(); // Clone response to read body, use text() in case it's not JSON
      console.log(`Upstream API Response Status: ${apiResponse.status}`);
      console.log(`Upstream API Response Body: ${apiResponseBody}`);
      // --- END DEBUGGING ---

      // 7. Return the API's Response back to the Client (with CORS headers)
      // Create a mutable copy of the headers to add CORS headers
      const responseHeaders = new Headers(apiResponse.headers);
      responseHeaders.set('Access-Control-Allow-Origin', allowedOrigin);
     
      return new Response(apiResponse.body, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        headers: responseHeaders, // Use the modified headers
      });

    } catch (error) {
      // Handle errors during JSON parsing or the fetch to the upstream API
      console.error('Error processing request in worker:', error);
      let errorResponse;
      if (error instanceof SyntaxError) {
        // Error parsing the incoming JSON
        errorResponse = new Response('Bad Request: Invalid JSON format', { status: 400 });
      } else {
        // Network error contacting upstream API, or other unexpected error
        errorResponse = new Response('Bad Gateway: Error contacting matchmaking service', { status: 502 });
      }
      // Add CORS headers to the error response
      return addCorsHeaders(errorResponse, allowedOrigin);
    }
  },
};

// Helper function to handle CORS preflight OPTIONS requests
function handleOptions(request, allowedOrigin) {
  const headers = request.headers;
  if (
    headers.get('Origin') !== null &&
    headers.get('Access-Control-Request-Method') !== null &&
    headers.get('Access-Control-Request-Headers') !== null
  ) {
    // Respond to CORS preflight request
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS', // Allow POST and OPTIONS
        'Access-Control-Allow-Headers': 'Content-Type', // Allow Content-Type header
        'Access-Control-Max-Age': '86400', // Cache preflight response for 1 day (optional)
      },
    });
  } else {
    // Handle standard OPTIONS request (without CORS headers)
    return new Response(null, {
      headers: {
        Allow: 'POST, OPTIONS', // Indicate allowed methods
      },
    });
  }
}

// Helper function to add standard CORS headers to any outgoing response
function addCorsHeaders(response, allowedOrigin) {
  // Create a mutable copy of the headers object
  const newHeaders = new Headers(response.headers);
  // Add the main CORS header
  newHeaders.set('Access-Control-Allow-Origin', allowedOrigin);
  
  // Optionally add other CORS headers if needed, e.g., for credentials or specific methods/headers
  // newHeaders.set('Access-Control-Allow-Credentials', 'true'); 
  
  // Return a new response with the modified headers
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
} 