
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method not allowed",
    };
  }

  try {
    const callback = JSON.parse(event.body || "{}");
    const result = callback?.Body?.stkCallback;

    if (!result) {
      console.error("Unexpected M-Pesa callback format.");
      return {
        statusCode: 400,
        body: JSON.stringify({ ResultCode: 1, ResultDesc: "Invalid callback" }),
      };
    }

    // Log the result for initial sandbox testing.
    // This does NOT permanently save donation records.
    console.log("M-Pesa callback received:", JSON.stringify(result));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ResultCode: 0,
        ResultDesc: "Accepted",
      }),
    };
  } catch (error) {
    console.error("Callback processing error:", error.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ ResultCode: 1, ResultDesc: "Invalid request" }),
    };
  }
};
