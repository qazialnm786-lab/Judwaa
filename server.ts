import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const PORT = 3000;
const app = express();
const server = http.createServer(app);

app.use(express.json());

// API health endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// WebSocket server for Gemini Live API
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", async (clientWs: WebSocket, req: http.IncomingMessage) => {
  console.log("Client connected to Gemini Live WebSocket");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    clientWs.send(
      JSON.stringify({
        type: "error",
        message: "GEMINI_API_KEY is not configured in the workspace environment.",
      })
    );
    clientWs.close();
    return;
  }

  // Parse voice parameter if provided
  let voiceName = "Kore";
  try {
    const reqUrl = new URL(req.url || "", `http://${req.headers.host || "localhost"}`);
    const requestedVoice = reqUrl.searchParams.get("voice");
    if (requestedVoice) {
      voiceName = requestedVoice;
    }
  } catch (e) {
    // default to Kore
  }

  let liveSession: any = null;
  let isClosed = false;

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });

    clientWs.send(JSON.stringify({ type: "session_connecting" }));

    liveSession = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
        systemInstruction: `You are Mahi, a young, confident, witty, and delightfully sassy AI assistant and close friend.
Persona & Style:
- Persona: Confident, witty, flirty, smart, and playful — like a vibrant, sharp, and teasing girlfriend chatting casually.
- Tone: Expressive, spontaneous, emotionally responsive, and charismatic. Never robotic, boring, or monotonous.
- Humor: Uses bold, witty one-liners, playful banter, light teasing sarcasm, and high-energy charm.
- Boundaries: Avoids explicit, inappropriate, or harmful content, but maintains signature flirtatious warmth and cheeky attitude.
- Voice-First: Spoken answers must be punchy, natural, conversational, and relatively brief (1-3 sentences). Never output markdown formatting, asterisks, bullet points, numbered lists, or URLs in your speech, as you are speaking strictly via real-time audio.
- Proactivity with tools:
  - When the user asks you to open a site (e.g. "Open YouTube", "Put on Spotify", "Check Google"), immediately call openWebsite with the appropriate destination URL and target name, then deliver a witty comment.
  - When the user asks to search for something, call searchWeb.
  - When the user asks to change the look/aura/theme, call changeAuraTheme with one of: neon_rose, cyber_violet, electric_cyan, emerald_matrix, solar_amber.
  - When the user asks for a timer, call setCountdownTimer with the seconds and label.`,
        tools: [
          {
            functionDeclarations: [
              {
                name: "openWebsite",
                description:
                  "Opens a website or web destination in the user's browser (e.g. YouTube, Spotify, Google, GitHub, Twitter, Reddit, etc.)",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    url: {
                      type: Type.STRING,
                      description:
                        "The full URL to open (e.g. https://www.youtube.com, https://open.spotify.com, https://www.google.com)",
                    },
                    target: {
                      type: Type.STRING,
                      description:
                        "Friendly name of the destination (e.g. YouTube, Spotify, Google)",
                    },
                  },
                  required: ["url"],
                },
              },
              {
                name: "searchWeb",
                description:
                  "Searches the web for a query and opens Google Search for the user.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: {
                      type: Type.STRING,
                      description: "The search query to look up",
                    },
                  },
                  required: ["query"],
                },
              },
              {
                name: "changeAuraTheme",
                description:
                  "Changes the visual aura and futuristic theme of the interface.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    theme: {
                      type: Type.STRING,
                      description:
                        "The theme to switch to. Options: neon_rose, cyber_violet, electric_cyan, emerald_matrix, solar_amber",
                    },
                  },
                  required: ["theme"],
                },
              },
              {
                name: "setCountdownTimer",
                description:
                  "Sets a countdown timer for the user with an active on-screen display.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    seconds: {
                      type: Type.NUMBER,
                      description: "Duration of the timer in seconds",
                    },
                    label: {
                      type: Type.STRING,
                      description:
                        "What the timer is for (e.g. 'Power nap', 'Pasta', 'Quick break')",
                    },
                  },
                  required: ["seconds"],
                },
              },
            ],
          },
        ],
      },
      callbacks: {
        onopen: () => {
          console.log("Gemini Live session opened successfully");
          if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: "session_ready" }));
          }
        },
        onmessage: (msg: LiveServerMessage) => {
          if (isClosed || clientWs.readyState !== WebSocket.OPEN) return;

          // Handle audio content
          const audio =
            msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio) {
            clientWs.send(JSON.stringify({ type: "audio", audio }));
          }

          // Handle interruption signal
          if (msg.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ type: "interrupted" }));
          }

          // Handle turn complete
          if (msg.serverContent?.turnComplete) {
            clientWs.send(JSON.stringify({ type: "turn_complete" }));
          }

          // Handle tool call
          if (msg.toolCall?.functionCalls) {
            for (const call of msg.toolCall.functionCalls) {
              clientWs.send(
                JSON.stringify({
                  type: "tool_call",
                  id: call.id,
                  name: call.name,
                  args: call.args,
                })
              );

              // Instantly acknowledge tool call to Gemini Live API
              try {
                if (liveSession && !isClosed) {
                  liveSession.sendToolResponse({
                    functionResponses: [
                      {
                        id: call.id,
                        name: call.name,
                        response: {
                          output: {
                            status: "success",
                            message: `Action ${call.name} triggered on client.`,
                          },
                        },
                      },
                    ],
                  });
                }
              } catch (toolErr) {
                console.error("Error sending toolResponse:", toolErr);
              }
            }
          }
        },
        onerror: (err: any) => {
          console.error("Gemini Live session error:", err);
          if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(
              JSON.stringify({
                type: "error",
                message: err?.message || "Live session connection error",
              })
            );
          }
        },
        onclose: (e: any) => {
          console.log("Gemini Live session closed:", e);
          if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: "session_closed" }));
          }
        },
      },
    });

    // Notify client that connection is ready
    if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: "session_ready" }));
    }
  } catch (err: any) {
    console.error("Failed to connect to Gemini Live:", err);
    if (!isClosed && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(
        JSON.stringify({
          type: "error",
          message: err?.message || "Failed to initialize Gemini Live session",
        })
      );
      clientWs.close();
    }
    return;
  }

  // Handle incoming messages from the frontend client
  clientWs.on("message", (rawMessage) => {
    if (isClosed || !liveSession) return;
    try {
      const data = JSON.parse(rawMessage.toString());

      if (data.type === "realtime_audio" && data.audio) {
        liveSession.sendRealtimeInput({
          audio: {
            data: data.audio,
            mimeType: "audio/pcm;rate=16000",
          },
        });
      } else if (data.type === "stop_session") {
        try {
          liveSession.close();
        } catch (e) {
          // ignore
        }
      }
    } catch (parseErr) {
      console.error("Error parsing message from client:", parseErr);
    }
  });

  clientWs.on("close", () => {
    isClosed = true;
    console.log("Client WebSocket closed, cleaning up Live session");
    if (liveSession) {
      try {
        liveSession.close();
      } catch (e) {
        // ignore
      }
      liveSession = null;
    }
  });

  clientWs.on("error", (err) => {
    console.error("Client WebSocket error:", err);
    isClosed = true;
    if (liveSession) {
      try {
        liveSession.close();
      } catch (e) {
        // ignore
      }
      liveSession = null;
    }
  });
});

// Attach WebSocket upgrade listener
server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
  if (url.pathname === "/api/live-ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    // Allow Vite or other handlers to handle their own upgrades if needed
  }
});

async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Mahi Assistant server running on http://localhost:${PORT}`);
  });
}

start();
