import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Mic,
  MicOff,
  Send,
  User,
} from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";

export function ChatDemo() {
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([
    {
      type: "bot",
      content:
        "Hello! I can help you explore store data through chat. Try asking about sales, inventory, or customer activity.",
    },
  ]);
  const messagesContainerRef = useRef<HTMLDivElement | null>(
    null,
  );

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  const sampleQueries = [
    "What are my top 5 selling products this week?",
    "Show me customers who haven't visited in 30 days",
    "What's my current inventory value?",
    "Which products are running low on stock?",
    "How much did I make yesterday compared to last week?",
  ];

  const handleSampleQuery = (query: string) => {
    setMessages((prev) => [
      ...prev,
      { type: "user", content: query },
      {
        type: "bot",
        content: query.includes("top 5")
          ? "Here are your top 5 selling products this week:\n\n1. iPhone 15 Pro - 23 units sold\n2. Samsung Galaxy Buds - 18 units\n3. Wireless Charger - 15 units\n4. Phone Cases - 12 units\n5. Screen Protectors - 10 units\n\nTotal revenue from these items: Rs 8,54,750"
          : query.includes("inventory value")
            ? "Your current inventory value is Rs 47,83,200 across 1,247 items.\n\nElectronics: Rs 32,15,000\nAccessories: Rs 12,68,000\nOther: Rs 3,00,200\n\nInventory turnover rate: 2.3x this quarter"
            : "I found the information you requested. Sales are trending positively across the main retail categories. Let me know if you want a more detailed breakdown.",
      },
    ]);
  };

  const toggleListening = () => {
    setIsListening(!isListening);

    if (!isListening) {
      setTimeout(() => {
        setIsListening(false);
        setMessages((prev) => [
          ...prev,
          {
            type: "user",
            content: "Show me today's sales summary",
          },
          {
            type: "bot",
            content:
              "Today's sales summary:\n\nTotal Revenue: Rs 2,84,750\nTransactions: 47\nAverage Order Value: Rs 6,057\n\nTop Category: Electronics\nPeak Hour: 2 PM to 3 PM\n\nComparison to yesterday: +12% revenue and +5 transactions",
          },
        ]);
      }, 3000);
    }
  };

  return (
    <section id="demo" className="py-20">
      <div className="container mx-auto px-4">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-3xl font-bold lg:text-5xl">
            See It In
            <span className="text-primary"> Action</span>
          </h2>
          <p className="mx-auto max-w-2xl text-xl text-muted-foreground">
            Try a few sample questions and see how the chat
            experience can surface useful retail insights.
          </p>
        </div>

        <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="flex h-[600px] flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  Aska Assistant
                  <Badge variant="secondary" className="ml-auto">
                    Demo
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col overflow-hidden">
                <div
                  ref={messagesContainerRef}
                  className="mb-4 flex-1 space-y-4 overflow-y-auto pr-2"
                >
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${
                        message.type === "user"
                          ? "justify-end"
                          : ""
                      }`}
                    >
                      <div
                        className={`flex max-w-[80%] gap-3 ${
                          message.type === "user"
                            ? "flex-row-reverse"
                            : ""
                        }`}
                      >
                        <div
                          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                            message.type === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          {message.type === "user" ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Bot className="h-4 w-4" />
                          )}
                        </div>
                        <div
                          className={`rounded-2xl px-4 py-3 ${
                            message.type === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="whitespace-pre-line">
                            {message.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant={isListening ? "destructive" : "outline"}
                    size="icon"
                    onClick={toggleListening}
                    className={isListening ? "animate-pulse" : ""}
                  >
                    {isListening ? (
                      <Mic className="h-4 w-4" />
                    ) : (
                      <MicOff className="h-4 w-4" />
                    )}
                  </Button>
                  <div className="flex flex-1 items-center rounded-lg bg-muted px-4 py-2">
                    {isListening ? (
                      <span className="animate-pulse text-sm text-muted-foreground">
                        Listening...
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Click the mic to speak or try one of the
                        sample questions.
                      </span>
                    )}
                  </div>
                  <Button size="icon" variant="outline">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Try These Questions</h3>
            <div className="space-y-3">
              {sampleQueries.map((query, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto w-full justify-start whitespace-normal p-4 text-left"
                  onClick={() => handleSampleQuery(query)}
                >
                  {query}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
