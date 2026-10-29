
exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
  };

  const reply = (statusCode, data) => ({
    statusCode,
    headers,
    body: JSON.stringify(data),
  });

  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Method not allowed." });
  }

  try {
    const { amount, phone } = JSON.parse(event.body || "{}");

    const donationAmount = Number(amount);
    let phoneNumber = String(phone || "").replace(/[\s-]/g, "");

    if (phoneNumber.startsWith("+")) {
      phoneNumber = phoneNumber.slice(1);
    }

    if (phoneNumber.startsWith("0")) {
      phoneNumber = "254" + phoneNumber.slice(1);
    }

    if (!Number.isInteger(donationAmount) || donationAmount < 1) {
      return reply(400, {
        error: "Enter a valid donation amount in KSh.",
      });
    }

    if (!/^254[17]\d{8}$/.test(phoneNumber)) {
      return reply(400, {
        error: "Enter a valid Kenyan mobile number.",
      });
    }

    const {
      MPESA_CONSUMER_KEY,
      MPESA_CONSUMER_SECRET,
      MPESA_SHORTCODE,
      MPESA_PASSKEY,
      MPESA_ENV,
      MPESA_CALLBACK_URL,
    } = process.env;

    if (
      !MPESA_CONSUMER_KEY ||
      !MPESA_CONSUMER_SECRET ||
      !MPESA_SHORTCODE ||
      !MPESA_PASSKEY ||
      !MPESA_CALLBACK_URL
    ) {
      return reply(500, {
        error: "M-Pesa configuration is incomplete.",
      });
    }

    const baseUrl =
      MPESA_ENV === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    const auth = Buffer.from(
      `${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`
    ).toString("base64");

    const tokenResponse = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error("M-Pesa token request failed.");
      return reply(502, {
        error: "Could not connect to M-Pesa. Please try again later.",
      });
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[-T:.Z]/g, "")
      .slice(0, 14);

    const password = Buffer.from(
      `${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`
    ).toString("base64");

    const stkResponse = await fetch(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BusinessShortCode: MPESA_SHORTCODE,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: donationAmount,
          PartyA: phoneNumber,
          PartyB: MPESA_SHORTCODE,
          PhoneNumber: phoneNumber,
          CallBackURL: MPESA_CALLBACK_URL,
          AccountReference: "ATAA",
          TransactionDesc: "Ataa Foundation Donation",
        }),
      }
    );

    const stkData = await stkResponse.json();

    if (!stkResponse.ok || stkData.ResponseCode !== "0") {
      console.error("M-Pesa STK request was rejected.");
      return reply(502, {
        error:
          stkData.errorMessage ||
          stkData.ResponseDescription ||
          "M-Pesa could not start the payment. Please try again.",
      });
    }

    return reply(200, {
      success: true,
      message:
        "Payment request sent. Check your phone and follow the M-Pesa prompt.",
      checkoutRequestID: stkData.CheckoutRequestID,
      merchantRequestID: stkData.MerchantRequestID,
    });
  } catch (error) {
    console.error("STK Push error:", error.message);
    return reply(500, {
      error: "Something went wrong. Please try again.",
    });
  }
};
