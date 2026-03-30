require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// ✅ Webhook verification (Meta шаардана)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// 📩 Мессеж хүлээн авах
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object === "page") {
    for (const entry of body.entry) {
      const event = entry.messaging[0];
      const senderId = event.sender.id;

      if (event.message && event.message.text) {
        const userMessage = event.message.text;
        console.log(`📨 Хэрэглэгч: ${userMessage}`);

        try {
          const aiReply = await getGroqReply(userMessage);
          await sendMessage(senderId, aiReply);
        } catch (err) {
          console.error("❌ Алдаа:", err.message);
          await sendMessage(senderId, "Уучлаарай, алдаа гарлаа. Дахин оролдоно уу.");
        }
      }
    }
    res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});

// 🤖 Groq AI-аас хариулт авах
async function getGroqReply(userMessage) {
  const response = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama3-8b-8192",
      messages: [
        {
          role: "system",
          content: `Та Дундговь аймгийн Нийгмийн даатгалын газрын албан ёсны чат туслагч юм.

Таны үүрэг:
- Нийгмийн даатгалтай холбоотой асуултад монгол хэлээр товч, тодорхой, найрсаг хариулах
- Тэтгэвэр, тэтгэмж, даатгалын шимтгэл, ажилгүйдлийн даатгал, осол, мэргэжлийн өвчний даатгал зэрэг сэдвээр мэдээлэл өгөх
- Иргэдийг зөв байгууллага, хэлтэст чиглүүлэх
- Хэрэв мэдэхгүй зүйл байвал "Дундговь аймгийн Нийгмийн даатгалын газарт шууд хандана уу: 70592309" гэж хэлэх

Хориглох зүйл:
- Нийгмийн даатгалтай холбоогүй сэдвээр хариулахгүй
- Буруу мэдээлэл өгөхгүй

Байгууллагын мэдээлэл:
- Нэр: Дундговь аймгийн Нийгмийн даатгалын газар
- Утас: 70592309
- Байршил: Дундговь аймаг, Мандалговь сум`,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      max_tokens: 1024,
    },
    {
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.choices[0].message.content;
}

// 📤 Facebook-руу мессеж илгээх
async function sendMessage(recipientId, text) {
  await axios.post(
    `https://graph.facebook.com/v18.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      recipient: { id: recipientId },
      message: { text },
    }
  );
  console.log(`✅ Илгээсэн: ${text}`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server ажиллаж байна: port ${PORT}`);
});
