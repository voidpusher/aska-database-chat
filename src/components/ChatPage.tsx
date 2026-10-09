import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  HelpCircle,
  LogOut,
  Menu,
  Mic,
  MicOff,
  Send,
  Settings,
  User,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  CHAT_INTENTS,
  CHAT_INTENT_QUESTION_COUNT,
  type IntentDefinition,
} from "../data/chatIntents";
import { api } from "../lib/api";
import { safeJsonParse, safeStorageGet } from "../lib/storage";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { ChatAnswer } from "./ChatAnswer";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { ScrollArea } from "./ui/scroll-area";

interface ChatPageProps {
  onLogout: () => void;
  onNavigateToSupport: () => void;
  onNavigateToDashboard: () => void;
  onNavigateToLanding?: () => void;
  onNavigateToPricing?: () => void;
}

interface Message {
  id: string;
  type: "user" | "ai";
  content: string;
  sql?: string | null;
  timestamp: Date;
}

interface QuickStat {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}

interface ConversationMemory {
  lastIntentId: string | null;
  intentCounts: Record<string, number>;
}

type ResponseStyle = "english" | "hinglish" | "hindi";

interface LocalizedCopy {
  response: string;
  followUp: string;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

const ASSISTANT_NAME = "Aska";
const ASSISTANT_FULL_NAME = "Aska";
const DEFAULT_WELCOME_MESSAGE: Message = {
  id: "welcome-message",
  type: "ai",
  content:
    `I'm ${ASSISTANT_FULL_NAME}. I can help you read your store performance, spot risks, and suggest the next move. Try asking something like "What were my sales yesterday?" or "Show me my top products this week."`,
  timestamp: new Date(),
};
const HINDI_CHAR_REGEX = /[\u0900-\u097F]/;
const HINGLISH_HINTS = [
  "kya",
  "kitna",
  "kaise",
  "dikhao",
  "batao",
  "mera",
  "meri",
  "mujhe",
  "stock",
  "becho",
  "sale",
  "kal",
  "aaj",
  "profit",
  "margin",
  "customer",
  "kitne",
  "wali",
  "wala",
  "kaun",
];

function combineInputSegments(
  baseText: string,
  transcript: string,
) {
  if (!transcript) {
    return baseText;
  }

  if (!baseText) {
    return transcript;
  }

  return `${baseText}${baseText.endsWith(" ") ? "" : " "}${transcript}`;
}

const LOCALIZED_INTENT_COPY: Record<
  string,
  { hinglish: LocalizedCopy; hindi: LocalizedCopy }
> = {
  sales_yesterday: {
    hinglish: {
      response:
        "Kal aapki sales Rs 2,84,750 rahi aur total 43 orders aaye. Yeh last week ke same din se 12% zyada hai, aur sabse strong contribution power banks aur mid-range smartphones se aaya.",
      followUp:
        "Chahein to main isko product-wise, hour-wise, ya payment method-wise bhi tod kar dikha sakta hoon.",
    },
    hindi: {
      response:
        "कल आपकी कुल बिक्री Rs 2,84,750 रही और 43 ऑर्डर आए। यह पिछले सप्ताह के उसी दिन की तुलना में 12% अधिक है, और सबसे अच्छा योगदान पावर बैंक तथा मिड-रेंज स्मार्टफोन्स से आया।",
      followUp:
        "यदि चाहें तो मैं इसे उत्पाद, घंटे या भुगतान माध्यम के हिसाब से भी दिखा सकता हूँ।",
    },
  },
  sales_today: {
    hinglish: {
      response:
        "Aaj abhi tak aapki store sales Rs 1,96,400 tak pahunch chuki hai aur 29 orders aaye hain. Volume mein mobile accessories lead kar rahi hain, aur sabse strong sales hour 1 PM se 2 PM raha.",
      followUp:
        "Main aaj ko kal se compare bhi kar sakta hoon ya bata sakta hoon ki kaunsi category aaj numbers push kar rahi hai.",
    },
    hindi: {
      response:
        "आज अभी तक आपके स्टोर की बिक्री Rs 1,96,400 तक पहुंच चुकी है और 29 ऑर्डर आए हैं। मात्रा के हिसाब से मोबाइल एक्सेसरीज़ आगे हैं, और सबसे मजबूत बिक्री समय 1 PM से 2 PM रहा।",
      followUp:
        "मैं आज की बिक्री को कल से तुलना करके भी दिखा सकता हूँ या यह बता सकता हूँ कि कौन-सी श्रेणी आज के नंबर बढ़ा रही है।",
    },
  },
  weekly_sales: {
    hinglish: {
      response:
        "Is week aap Rs 12,48,900 sales par ho, total 214 orders ke saath. Yeh last week se 9% better hai, aur accessories aur audio devices growth ko sabse zyada push kar rahe hain.",
      followUp:
        "Main yeh bhi bata sakta hoon ki kaunse products ya customers is weekly growth ke peeche hain.",
    },
    hindi: {
      response:
        "इस सप्ताह आपकी कुल बिक्री Rs 12,48,900 है और 214 ऑर्डर आए हैं। यह पिछले सप्ताह से 9% बेहतर है, और एक्सेसरीज़ तथा ऑडियो डिवाइस सबसे अधिक वृद्धि दे रहे हैं।",
      followUp:
        "मैं यह भी बता सकता हूँ कि इस साप्ताहिक वृद्धि के पीछे कौन-से उत्पाद या ग्राहक हैं।",
    },
  },
  monthly_comparison: {
    hinglish: {
      response:
        "Last month ke comparison mein sales 18% up hain, orders 22% up hain, aur new customers 31% zyada aaye hain. Average order value 3% neeche gayi hai, jo dikhata hai ki accessory-led purchases badh rahi hain.",
      followUp:
        "Agar chaho to main clear bata sakta hoon ki month-to-month sabse bada change kis area mein aaya.",
    },
    hindi: {
      response:
        "पिछले महीने की तुलना में बिक्री 18% बढ़ी है, ऑर्डर 22% बढ़े हैं, और नए ग्राहक 31% अधिक आए हैं। औसत ऑर्डर वैल्यू 3% कम हुई है, जिससे लगता है कि एक्सेसरी-आधारित खरीद अधिक बढ़ी है।",
      followUp:
        "यदि चाहें तो मैं बता सकता हूँ कि महीने-दर-महीने सबसे बड़ा बदलाव किस हिस्से में आया।",
    },
  },
  top_products: {
    hinglish: {
      response:
        "Is week ke top 5 products hain Xiaomi Power Bank 20000mAh, Realme Buds Air 3 TWS Earbuds, Logitech K380 Wireless Keyboard, Samsung Galaxy A34 5G, aur Samsung 43-inch Smart LED TV. Volume mein Xiaomi lead kar raha hai, jabki revenue mein Samsung top par hai.",
      followUp:
        "Main is list ko units sold, revenue, ya margin ke hisaab se bhi sort karke dikha sakta hoon.",
    },
    hindi: {
      response:
        "इस सप्ताह के शीर्ष 5 उत्पाद हैं Xiaomi Power Bank 20000mAh, Realme Buds Air 3 TWS Earbuds, Logitech K380 Wireless Keyboard, Samsung Galaxy A34 5G, और Samsung 43-inch Smart LED TV। यूनिट बिक्री में Xiaomi आगे है, जबकि राजस्व में Samsung शीर्ष पर है।",
      followUp:
        "मैं इस सूची को यूनिट बिक्री, राजस्व या मार्जिन के आधार पर भी दिखा सकता हूँ।",
    },
  },
  top_categories: {
    hinglish: {
      response:
        "Is month aapki strongest category mobile accessories hai, jo total unit sales ka 28% aur 45% margin contribute kar rahi hai. Audio devices second par hain, jabki televisions premium-ticket revenue lead kar rahe hain.",
      followUp:
        "Main category performance ko sales, margin, ya stock risk ke basis par aur detail mein compare kar sakta hoon.",
    },
    hindi: {
      response:
        "इस महीने आपकी सबसे मजबूत श्रेणी मोबाइल एक्सेसरीज़ है, जो कुल यूनिट बिक्री का 28% और 45% मार्जिन दे रही है। ऑडियो डिवाइस दूसरे स्थान पर हैं, जबकि टेलीविज़न प्रीमियम-टिकट राजस्व में आगे हैं।",
      followUp:
        "मैं श्रेणी प्रदर्शन को बिक्री, मार्जिन या स्टॉक जोखिम के आधार पर और विस्तार से तुलना कर सकता हूँ।",
    },
  },
  inventory_status: {
    hinglish: {
      response:
        "Overall inventory healthy lag rahi hai, lekin Lenovo IdeaPad Slim 3, Samsung 43-inch Smart LED TV, HP LaserJet M126nw Printer, aur Samsung Galaxy A34 5G low side par chal rahe hain. Power banks, earbuds aur headphones achhe stock mein hain.",
      followUp:
        "Main restock priority bhi bata sakta hoon ya yeh dikha sakta hoon ki kaunse SKUs overstocked hain.",
    },
    hindi: {
      response:
        "कुल मिलाकर इन्वेंटरी ठीक है, लेकिन Lenovo IdeaPad Slim 3, Samsung 43-inch Smart LED TV, HP LaserJet M126nw Printer, और Samsung Galaxy A34 5G का स्टॉक कम हो रहा है। पावर बैंक, ईयरबड्स और हेडफोन्स पर्याप्त मात्रा में उपलब्ध हैं।",
      followUp:
        "मैं रिस्टॉक प्राथमिकता भी बता सकता हूँ या यह दिखा सकता हूँ कि कौन-से SKU अधिक स्टॉक में हैं।",
    },
  },
  low_stock: {
    hinglish: {
      response:
        "Sabse urgent low-stock items hain Lenovo IdeaPad Slim 3 with 6 units, Samsung 43-inch Smart LED TV with 8, HP LaserJet M126nw Printer with 11, aur Samsung Galaxy A34 5G with 12. Mere hisaab se laptops aur TVs ko pehle prioritize karna chahiye kyunki inki value aur movement dono strong hain.",
      followUp:
        "Chahein to main isko direct reorder plan mein convert kar deta hoon.",
    },
    hindi: {
      response:
        "सबसे अधिक ध्यान देने योग्य लो-स्टॉक आइटम हैं Lenovo IdeaPad Slim 3 जिसमें 6 यूनिट बची हैं, Samsung 43-inch Smart LED TV में 8, HP LaserJet M126nw Printer में 11, और Samsung Galaxy A34 5G में 12। मेरी सलाह है कि लैपटॉप और टीवी को पहले प्राथमिकता दें क्योंकि इनकी कीमत और मांग दोनों मजबूत हैं।",
      followUp:
        "यदि चाहें तो मैं इसे सीधे रिऑर्डर प्लान में बदल सकता हूँ।",
    },
  },
  out_of_stock_risk: {
    hinglish: {
      response:
        "Current sales speed ke hisaab se Lenovo IdeaPad Slim 3 3 din mein stockout ho sakta hai, Samsung 43-inch Smart LED TV 4 din mein, aur Samsung Galaxy A34 5G is week ke andar risky zone mein aa jayega. Yehi abhi aapke highest stockout risks hain.",
      followUp:
        "Main yeh bhi estimate kar sakta hoon ki kitna reorder karna chahiye taaki sales loss na ho.",
    },
    hindi: {
      response:
        "मौजूदा बिक्री गति के अनुसार Lenovo IdeaPad Slim 3 लगभग 3 दिनों में स्टॉकआउट हो सकता है, Samsung 43-inch Smart LED TV 4 दिनों में, और Samsung Galaxy A34 5G इसी सप्ताह जोखिम में आ सकता है। यही इस समय आपके सबसे बड़े स्टॉकआउट जोखिम हैं।",
      followUp:
        "मैं यह भी अनुमान लगा सकता हूँ कि बिक्री नुकसान से बचने के लिए कितना रिऑर्डर करना चाहिए।",
    },
  },
  reorder_suggestions: {
    hinglish: {
      response:
        "Recommended reorder list hai: 20 Lenovo IdeaPad Slim 3 units, 15 Samsung 43-inch Smart LED TVs, 25 Samsung Galaxy A34 5G phones, aur 18 HP LaserJet M126nw Printers. Isse agle 2 weeks ki projected demand comfortable buffer ke saath cover ho jayegi.",
      followUp:
        "Agar chaho to main sirf fast-moving ya high-margin items tak is list ko short bhi kar sakta hoon.",
    },
    hindi: {
      response:
        "सुझाई गई रिऑर्डर सूची है: 20 Lenovo IdeaPad Slim 3 यूनिट, 15 Samsung 43-inch Smart LED TV, 25 Samsung Galaxy A34 5G फोन, और 18 HP LaserJet M126nw Printer। इससे अगले 2 सप्ताह की संभावित मांग सुरक्षित बफर के साथ पूरी हो जाएगी।",
      followUp:
        "यदि चाहें तो मैं इस सूची को केवल तेज़ी से बिकने वाले या अधिक मार्जिन वाले आइटम तक सीमित कर सकता हूँ।",
    },
  },
  profit_margin: {
    hinglish: {
      response:
        "Aapka overall gross margin abhi 32.8% hai. Mobile accessories 45% ke saath strongest hain, audio devices 38% par hain, computer accessories 35% par, aur laptops aur TVs jaise premium hardware 24% par hain lekin revenue ke liye important bane hue hain.",
      followUp:
        "Main margin leakage bhi highlight kar sakta hoon ya bata sakta hoon kis item ki pricing rethink karni chahiye.",
    },
    hindi: {
      response:
        "आपका कुल ग्रॉस मार्जिन इस समय 32.8% है। मोबाइल एक्सेसरीज़ 45% के साथ सबसे मजबूत हैं, ऑडियो डिवाइस 38% पर हैं, कंप्यूटर एक्सेसरीज़ 35% पर, और लैपटॉप तथा टीवी जैसे प्रीमियम हार्डवेयर 24% पर हैं, लेकिन राजस्व के लिए अभी भी महत्वपूर्ण हैं।",
      followUp:
        "मैं यह भी दिखा सकता हूँ कि मार्जिन कहाँ कम हो रहा है या किन वस्तुओं की कीमत पर दोबारा सोचना चाहिए।",
    },
  },
  highest_profit_products: {
    hinglish: {
      response:
        "Aapke sabse profitable products abhi premium phone accessories, wireless earbuds, aur branded chargers hain. Inki movement fast hai, capital kam block hota hai, aur ye consistently 40% se upar margin dete hain.",
      followUp:
        "Main in high-margin products ke around bundles ya promotions bhi suggest kar sakta hoon.",
    },
    hindi: {
      response:
        "इस समय आपके सबसे अधिक लाभ देने वाले उत्पाद प्रीमियम फोन एक्सेसरीज़, वायरलेस ईयरबड्स और ब्रांडेड चार्जर हैं। इनकी बिक्री तेज़ है, इन पर कम पूंजी अटकती है, और ये लगातार 40% से अधिक मार्जिन देते हैं।",
      followUp:
        "मैं इन उच्च-मार्जिन उत्पादों के लिए बंडल या प्रमोशन भी सुझा सकता हूँ।",
    },
  },
  top_customers: {
    hinglish: {
      response:
        "Is month aapke top customers Amit Kumar, Rajesh Electronics, Priya Patel, Vikash Singh, aur Sneha Gupta hain. Amit Kumar sabse aage hai, 18 orders aur Rs 1,87,450 spend ke saath.",
      followUp:
        "Chahein to main high-frequency buyers aur high-value buyers ko alag karke bhi dikha sakta hoon.",
    },
    hindi: {
      response:
        "इस महीने आपके शीर्ष ग्राहक Amit Kumar, Rajesh Electronics, Priya Patel, Vikash Singh और Sneha Gupta हैं। Amit Kumar 18 ऑर्डर और Rs 1,87,450 खर्च के साथ सबसे आगे हैं।",
      followUp:
        "यदि चाहें तो मैं अधिक बार खरीदने वाले और अधिक खर्च करने वाले ग्राहकों को अलग-अलग दिखा सकता हूँ।",
    },
  },
  repeat_customers: {
    hinglish: {
      response:
        "Repeat customers is month ke 41% orders aur 54% revenue contribute kar rahe hain. Yeh strong retention signal hai, khaaskar accessories aur audio device categories mein.",
      followUp:
        "Main yeh bhi bata sakta hoon ki loyal customers sabse zyada kya kharid rahe hain.",
    },
    hindi: {
      response:
        "इस महीने दोबारा खरीदने वाले ग्राहक 41% ऑर्डर और 54% राजस्व दे रहे हैं। यह एक मजबूत रिटेंशन संकेत है, खासकर एक्सेसरीज़ और ऑडियो डिवाइस श्रेणियों में।",
      followUp:
        "मैं यह भी बता सकता हूँ कि आपके वफादार ग्राहक सबसे अधिक क्या खरीद रहे हैं।",
    },
  },
  inactive_customers: {
    hinglish: {
      response:
        "Abhi 27 customers aise hain jinhone last 30 days mein purchase nahi kiya. Inmein se kaafi log pehle accessories kharidte the, isliye targeted follow-up offer se inko wapas lana possible lagta hai.",
      followUp:
        "Agar chaho to main in inactive buyers ke liye ek recovery campaign idea de sakta hoon.",
    },
    hindi: {
      response:
        "इस समय 27 ग्राहक ऐसे हैं जिन्होंने पिछले 30 दिनों में कोई खरीद नहीं की। इनमें से अधिकांश पहले एक्सेसरीज़ खरीदते थे, इसलिए लक्षित फॉलो-अप ऑफर से इन्हें वापस लाना संभव लगता है।",
      followUp:
        "यदि चाहें तो मैं इन निष्क्रिय ग्राहकों के लिए एक रिकवरी अभियान सुझाव दे सकता हूँ।",
    },
  },
  new_customers: {
    hinglish: {
      response:
        "Is month aapne 23 naye customers add kiye, jo last month se 31% zyada hai. Entry-priced accessories aur earbuds first-purchase products ke roop mein sabse strong perform kar rahe hain.",
      followUp:
        "Main yeh bhi dikha sakta hoon ki naye customers kis channel ya product se aa rahe hain.",
    },
    hindi: {
      response:
        "इस महीने आपने 23 नए ग्राहक जोड़े, जो पिछले महीने से 31% अधिक हैं। शुरुआती कीमत वाली एक्सेसरीज़ और ईयरबड्स पहली खरीद के रूप में सबसे अच्छा प्रदर्शन कर रहे हैं।",
      followUp:
        "मैं यह भी दिखा सकता हूँ कि नए ग्राहक किस चैनल या उत्पाद से आ रहे हैं।",
    },
  },
  average_order_value: {
    hinglish: {
      response:
        "Aapka current average order value Rs 6,621 hai. Yeh month-over-month 3% down hai, lekin order count up hone ki wajah se overall sales trend abhi bhi positive hai.",
      followUp:
        "Main bundle ya upsell opportunities bhi bata sakta hoon jisse AOV improve ho sake.",
    },
    hindi: {
      response:
        "आपका वर्तमान औसत ऑर्डर मूल्य Rs 6,621 है। यह महीने-दर-महीने 3% कम है, लेकिन ऑर्डर संख्या बढ़ने के कारण कुल बिक्री का रुझान अभी भी सकारात्मक है।",
      followUp:
        "मैं ऐसे बंडल या अपसेल अवसर भी बता सकता हूँ जिनसे औसत ऑर्डर मूल्य बढ़ सके।",
    },
  },
  discount_impact: {
    hinglish: {
      response:
        "Recent discount campaigns se unit sales 17% badhi, especially audio devices aur accessories mein. Lekin promoted items par margin lagbhag 2.4 points gira, isliye targeted promotions storewide discounts se better chal rahi hain.",
      followUp:
        "Main yeh bhi bata sakta hoon kaunse promotions worth the aur kaunse margin ko zyada hurt kar gaye.",
    },
    hindi: {
      response:
        "हाल की डिस्काउंट कैंपेन से यूनिट बिक्री 17% बढ़ी, खासकर ऑडियो डिवाइस और एक्सेसरीज़ में। लेकिन प्रमोटेड आइटम्स पर मार्जिन लगभग 2.4 अंक गिरा, इसलिए लक्षित प्रमोशन पूरे स्टोर पर डिस्काउंट देने से बेहतर काम कर रहे हैं।",
      followUp:
        "मैं यह भी बता सकता हूँ कि कौन-से प्रमोशन लाभदायक रहे और किनसे मार्जिन पर ज़्यादा असर पड़ा।",
    },
  },
  best_time_sales: {
    hinglish: {
      response:
        "Aapka peak sales window 2 PM se 4 PM tak hai, aur highest conversion around 3 PM hota hai. Shaam ko 7 PM se 8 PM bhi quick accessory purchases ke liye strong slot hai.",
      followUp:
        "Main isko staffing ya promotion timing recommendations mein bhi convert kar sakta hoon.",
    },
    hindi: {
      response:
        "आपकी सबसे मजबूत बिक्री अवधि 2 PM से 4 PM तक है, और सबसे अधिक कन्वर्ज़न लगभग 3 PM पर होता है। शाम 7 PM से 8 PM का समय भी तेज़ एक्सेसरी खरीद के लिए अच्छा है।",
      followUp:
        "मैं इसे स्टाफिंग या प्रमोशन टाइमिंग सुझावों में भी बदल सकता हूँ।",
    },
  },
  slow_moving_products: {
    hinglish: {
      response:
        "Aapke slow-moving items mein entry-level printers, older wired accessories, aur ek old keyboard model shamil hain. Yeh shelf space hold kar rahe hain aur inke liye bundling ya clearance pricing useful rahegi.",
      followUp:
        "Main suggest kar sakta hoon kaunse items pehle discount, bundle, ya phase-out karne chahiye.",
    },
    hindi: {
      response:
        "आपके धीमी गति से बिकने वाले आइटम्स में एंट्री-लेवल प्रिंटर, पुराने वायर्ड एक्सेसरीज़ और एक पुराना कीबोर्ड मॉडल शामिल हैं। ये शेल्फ स्पेस रोक रहे हैं और इनके लिए बंडलिंग या क्लियरेंस प्राइसिंग उपयोगी रहेगी।",
      followUp:
        "मैं सुझाव दे सकता हूँ कि किन वस्तुओं को पहले डिस्काउंट, बंडल या चरणबद्ध तरीके से हटाना चाहिए।",
    },
  },
  supplier_performance: {
    hinglish: {
      response:
        "Samsung aur Xiaomi suppliers fill rate aur delivery consistency mein achha perform kar rahe hain. Printer supplier sabse weak lag raha hai, kyunki uska turnaround average se 2.5 din slow chal raha hai.",
      followUp:
        "Main yeh bhi flag kar sakta hoon ki kaunse suppliers stockouts ya margins ko sabse zyada affect kar rahe hain.",
    },
    hindi: {
      response:
        "Samsung और Xiaomi के सप्लायर fill rate और delivery consistency में अच्छा प्रदर्शन कर रहे हैं। प्रिंटर सप्लायर सबसे कमजोर दिख रहा है, क्योंकि उसका turnaround औसत से 2.5 दिन धीमा है।",
      followUp:
        "मैं यह भी दिखा सकता हूँ कि कौन-से सप्लायर स्टॉकआउट या मार्जिन पर सबसे अधिक असर डाल रहे हैं।",
    },
  },
  cash_flow: {
    hinglish: {
      response:
        "Aapka cash flow abhi stable lag raha hai. Fast-moving accessories liquidity support kar rahi hain, lekin large hardware restocks ko stagger karna better hoga taaki working capital zyada lock na ho.",
      followUp:
        "Agar chaho to main restocking aur cash preservation ke beech better balance suggest kar sakta hoon.",
    },
    hindi: {
      response:
        "आपका कैश फ्लो अभी स्थिर दिख रहा है। तेज़ी से बिकने वाली एक्सेसरीज़ liquidity को सहारा दे रही हैं, लेकिन बड़े हार्डवेयर restock को चरणबद्ध करना बेहतर होगा ताकि working capital अधिक न अटके।",
      followUp:
        "यदि चाहें तो मैं restocking और cash preservation के बीच बेहतर संतुलन सुझा सकता हूँ।",
    },
  },
  payment_methods: {
    hinglish: {
      response:
        "UPI aapka top payment method hai, total 46% transactions ke saath. Uske baad card 31%, cash 19%, aur wallet payments 4% par hain. UPI users sabse fast checkout complete karte hain.",
      followUp:
        "Main payment mix ko order size ya customer segment ke hisaab se bhi compare kar sakta hoon.",
    },
    hindi: {
      response:
        "UPI आपका सबसे बड़ा भुगतान माध्यम है, कुल 46% transactions के साथ। उसके बाद card 31%, cash 19%, और wallet payments 4% पर हैं। UPI उपयोगकर्ता सबसे तेज़ checkout पूरा करते हैं।",
      followUp:
        "मैं payment mix को order size या customer segment के आधार पर भी compare कर सकता हूँ।",
    },
  },
  returns_refunds: {
    hinglish: {
      response:
        "Is month aapka return rate 2.8% hai, aur zyada returns low-cost accessories aur ek headphone SKU se aa rahe hain. Yeh manageable range mein hai, lekin supplier quality ko check karna worth rahega.",
      followUp:
        "Main exact SKUs bhi point out kar sakta hoon jo returns ko drive kar rahe hain.",
    },
    hindi: {
      response:
        "इस महीने आपका return rate 2.8% है, और अधिकतर returns low-cost accessories तथा एक headphone SKU से आ रहे हैं। यह manageable range में है, लेकिन supplier quality की जांच करना उचित रहेगा।",
      followUp:
        "मैं यह भी बता सकता हूँ कि कौन-से SKU returns को सबसे अधिक बढ़ा रहे हैं।",
    },
  },
  forecast_next_week: {
    hinglish: {
      response:
        "Recent trends ke basis par next week ki projected sales lagbhag Rs 13,10,000 se Rs 13,60,000 ke beech reh sakti hain. Accessories, earbuds aur power banks unit volume lead karenge, jabki TVs aur phones high-value transactions laayenge.",
      followUp:
        "Main is forecast ko staffing, stock, ya promotion recommendations mein bhi badal sakta hoon.",
    },
    hindi: {
      response:
        "हाल के ट्रेंड के आधार पर अगले सप्ताह की अनुमानित बिक्री लगभग Rs 13,10,000 से Rs 13,60,000 के बीच रह सकती है। एक्सेसरीज़, ईयरबड्स और पावर बैंक यूनिट वॉल्यूम में आगे रहेंगे, जबकि टीवी और फोन उच्च-मूल्य वाले लेनदेन देंगे।",
      followUp:
        "मैं इस forecast को staffing, stock या promotion recommendations में भी बदल सकता हूँ।",
    },
  },
  best_action: {
    hinglish: {
      response:
        "Meri top recommendation yeh hai ki aap fast-moving premium items ko restock karo, inactive customers ke liye targeted offer chalao, aur phone sales ke saath high-margin accessories push karo. Is combination se revenue aur margin dono improve honge bina extra operational complexity ke.",
      followUp:
        "Chahein to main isko is week ke simple action plan mein convert kar doon.",
    },
    hindi: {
      response:
        "मेरी सबसे महत्वपूर्ण सलाह यह है कि आप तेज़ी से बिकने वाले प्रीमियम आइटम्स को restock करें, inactive customers के लिए targeted offer चलाएँ, और phone sales के साथ high-margin accessories को आगे बढ़ाएँ। इससे बिना अतिरिक्त operational complexity के revenue और margin दोनों बेहतर होंगे।",
      followUp:
        "यदि चाहें तो मैं इसे इस सप्ताह के लिए एक सरल action plan में बदल सकता हूँ।",
    },
  },
};

export function ChatPage({
  onLogout,
  onNavigateToSupport,
  onNavigateToDashboard,
  onNavigateToLanding,
  onNavigateToPricing,
}: ChatPageProps) {
  const currentUser = safeJsonParse<{ authProvider?: string; businessName?: string; firstName?: string; lastName?: string }>(safeStorageGet("orrico_current_user"), {});
  const isDemoUser = currentUser.authProvider === "demo";
  const businessName = isDemoUser ? "Jai's Electronics" : currentUser.businessName || "Your Workspace";
  const initials = isDemoUser ? "JS" : `${currentUser.firstName?.[0] || ""}${currentUser.lastName?.[0] || ""}`.toUpperCase() || "U";
  const [sourceConnected, setSourceConnected] = useState(isDemoUser);
  const [intelligenceProvider, setIntelligenceProvider] = useState("checking");
  const [customerStats, setCustomerStats] = useState<QuickStat[]>([]);
  useEffect(() => {
    let active = true;
    api.intelligenceStatus().then(status => { if (active) setIntelligenceProvider(status.configured ? status.provider : "unconfigured"); }).catch(() => { if (active) setIntelligenceProvider("unavailable"); });
    api.currentDatabaseConnection().then(({ connection }) => {
      if (active) setSourceConnected(isDemoUser || Boolean(connection));
    }).catch(() => undefined);
    if (!isDemoUser) api.dashboardSummary().then(summary => {
      if (active && summary.available) setCustomerStats((summary.metrics || []).map(metric => ({ label: metric.title, value: metric.value, change: metric.change, positive: metric.positive })));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [isDemoUser]);
  const [messages, setMessages] = useState<Message[]>([
    DEFAULT_WELCOME_MESSAGE,
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [hasSpeechSupport, setHasSpeechSupport] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const inputValueRef = useRef("");
  const interimTranscriptRef = useRef("");
  const shouldSendAfterRecordingRef = useRef(false);
  const manualStopRef = useRef(false);
  const queryInFlightRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const memoryRef = useRef<ConversationMemory>({
    lastIntentId: null,
    intentCounts: {},
  });

  const quickStats: QuickStat[] = isDemoUser ? [
    {
      label: "Today's Sales",
      value: "Rs 2,84,750",
      change: "+12%",
      positive: true,
    },
    { label: "Orders", value: "43", change: "+8%", positive: true },
    {
      label: "Avg. Order",
      value: "Rs 6,621",
      change: "-3%",
      positive: false,
    },
    {
      label: "Top Product",
      value: "Xiaomi Power Bank",
      change: "24 sold",
      positive: true,
    },
  ] : customerStats.length ? customerStats : [
    { label: "Sales", value: "—", change: "", positive: true },
    { label: "Orders", value: "—", change: "", positive: true },
    { label: "Customers", value: "—", change: "", positive: true },
    { label: "Products", value: "—", change: "", positive: true },
  ];

  const quickQuestions = [
    "What were my sales yesterday?",
    "Show me top 5 products this week",
    "Which customers bought the most?",
    "How is inventory looking?",
    "Compare this month to last month",
    "What's my profit margin?",
  ];
  const displayedInputValue = combineInputSegments(
    inputValue,
    interimTranscript,
  );

  const renderSidebarContent = (mobile = false) => (
    <>
      <div className="border-b border-border/70 p-6">
        <Logo
          iconClassName="h-6 w-6"
          className="mb-4"
          onClick={onNavigateToLanding}
          clickable={!!onNavigateToLanding}
        />
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>JS</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">Gupta Electronics</p>
            <p className="text-sm text-muted-foreground">Vyapar Pro</p>
          </div>
        </div>
      </div>

      <div className="border-b border-border/70 p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Today's Overview</h3>
        <div className="space-y-3">
          {quickStats.map((stat, index) => (
            <div key={index} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/72 px-3 py-3">
              <span className="text-sm text-muted-foreground">
                {stat.label}
              </span>
              <div className="text-right">
                <p className="font-medium">{stat.value}</p>
                <Badge
                  variant={stat.positive ? "default" : "secondary"}
                  className="text-xs"
                >
                  {stat.change}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Quick Questions</h3>
        <div className="space-y-2">
          {quickQuestions.map((question, index) => (
            <Button
              key={index}
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-start rounded-xl border border-transparent p-3 text-left text-muted-foreground hover:border-border/70 hover:bg-background/80 hover:text-foreground"
              onClick={() => {
                if (isRecording && recognitionRef.current) {
                  shouldSendAfterRecordingRef.current = false;
                  manualStopRef.current = true;
                  recognitionRef.current.stop();
                }
                if (mobile) {
                  setIsMobileSidebarOpen(false);
                }
                handleSendMessage(question);
              }}
            >
              <span className="text-xs">{question}</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2 border-t border-border/70 p-6">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => {
            if (mobile) {
              setIsMobileSidebarOpen(false);
            }
            onNavigateToDashboard();
          }}
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          Dashboard
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => {
            if (mobile) {
              setIsMobileSidebarOpen(false);
            }
            onNavigateToSupport();
          }}
        >
          <HelpCircle className="mr-2 h-4 w-4" />
          Support
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={handleSettings}
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={() => {
            if (mobile) {
              setIsMobileSidebarOpen(false);
            }
            onLogout();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </>
  );

  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      "[data-slot='scroll-area-viewport']",
    ) as HTMLDivElement | null;

    if (!viewport) {
      return;
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let isMounted = true;

    api
      .chatHistory()
      .then(({ messages: history }) => {
        if (!isMounted || history.length === 0) {
          return;
        }

        const restoredMessages = history.filter(entry => entry.mode === "gemini").flatMap((entry) => {
          const createdAt = new Date(entry.createdAt);

          return [
            {
              id: `${entry.id}-user`,
              type: "user" as const,
              content: entry.message,
              timestamp: createdAt,
            },
            {
              id: `${entry.id}-ai`,
              type: "ai" as const,
              content: entry.reply,
              timestamp: createdAt,
            },
          ];
        });

        setMessages([
          DEFAULT_WELCOME_MESSAGE,
          ...restoredMessages,
        ]);
      })
      .catch(() => {
        return;
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    interimTranscriptRef.current = interimTranscript;
  }, [interimTranscript]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let liveTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript;

        if (event.results[index].isFinal) {
          finalTranscript += transcript;
        } else {
          liveTranscript += transcript;
        }
      }

      if (finalTranscript.trim()) {
        setInputValue((currentValue) => {
          return combineInputSegments(
            currentValue,
            finalTranscript.trim(),
          );
        });
      }

      setInterimTranscript(liveTranscript.trim());
    };

    recognition.onerror = (event) => {
      setIsRecording(false);
      setInterimTranscript("");

      if (
        manualStopRef.current &&
        (event.error === "aborted" || event.error === "no-speech")
      ) {
        manualStopRef.current = false;
        return;
      }

      if (event.error === "not-allowed") {
        toast.error("Microphone permission was blocked.");
        return;
      }

      if (event.error === "no-speech") {
        toast.info("I didn't catch that. Try speaking again.");
        return;
      }

      toast.error("Voice input is unavailable right now.");
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimTranscript("");
      const shouldSendAfterRecording =
        shouldSendAfterRecordingRef.current;
      manualStopRef.current = false;
      shouldSendAfterRecordingRef.current = false;

      if (shouldSendAfterRecording) {
        const messageToSend = combineInputSegments(
          inputValueRef.current.trim(),
          interimTranscriptRef.current.trim(),
        ).trim();

        if (messageToSend) {
          performSendMessage(messageToSend);
        }
      }
    };

    recognitionRef.current = recognition;
    setHasSpeechSupport(true);

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  const performSendMessage = async (message: string) => {
    if (!message.trim() || queryInFlightRef.current) return;
    if (message.length > 4000) { toast.error("Keep your question under 4,000 characters."); return; }
    queryInFlightRef.current = true;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setInterimTranscript("");
    setIsTyping(true);

    try {
      const result = await api.sendChatMessage(message);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: result.reply,
        sql: result.sql,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      const details = (error as { details?: { upgradeRequired?: boolean } })?.details;
      if (details?.upgradeRequired && onNavigateToPricing) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            type: "ai",
            content: "⚠️ You've used all your chat messages for this month. Upgrade your plan to continue.",
            timestamp: new Date(),
          },
        ]);
        setTimeout(onNavigateToPricing, 1800);
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : "Chat response could not be loaded.",
        );
      }
    } finally {
      queryInFlightRef.current = false;
      setIsTyping(false);
    }
  };

  const handleSendMessage = (message: string) => {
    const messageToSend = message.trim();

    if (!messageToSend) {
      return;
    }

    if (isRecording && recognitionRef.current) {
      shouldSendAfterRecordingRef.current = true;
      manualStopRef.current = true;
      recognitionRef.current.stop();
      return;
    }

    performSendMessage(messageToSend);
  };

  const normalizedIntentPatterns = useMemo(
    () =>
      CHAT_INTENTS.map((intent) => ({
        ...intent,
        normalizedPatterns: [...intent.patterns, ...intent.examples].map(
          (pattern) => pattern.toLowerCase(),
        ),
      })),
    [],
  );

  const detectResponseStyle = (message: string): ResponseStyle => {
    const normalizedMessage = message.toLowerCase();

    if (HINDI_CHAR_REGEX.test(message)) {
      return "hindi";
    }

    const hinglishScore = HINGLISH_HINTS.reduce((total, token) => {
      return normalizedMessage.includes(token) ? total + 1 : total;
    }, 0);

    return hinglishScore >= 2 ? "hinglish" : "english";
  };

  const findIntentResponse = (message: string) => {
    const normalizedMessage = message.toLowerCase().replace(/[^\w\s]/g, " ");
    const scoredIntents = normalizedIntentPatterns
      .map((intent) => {
        const score = intent.normalizedPatterns.reduce((total, pattern) => {
          let nextTotal = total;

          if (normalizedMessage.includes(pattern)) {
            nextTotal += 4;
          }

          const tokens = pattern.split(" ").filter((token) => token.length > 2);
          tokens.forEach((token) => {
            if (normalizedMessage.includes(token)) {
              nextTotal += 1;
            }
          });

          return nextTotal;
        }, 0);

        return { intent, score };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score);

    return scoredIntents[0]?.intent ?? null;
  };

  const buildAdaptiveResponse = (
    intent: IntentDefinition,
    style: ResponseStyle,
  ) => {
    const introOptions =
      style === "hindi"
        ? [
            "Yeh sabse important cheez dikh rahi hai.",
            "Maine check karke bataya hai.",
            "Aapke store data ka sabse clear read yeh hai.",
          ]
        : style === "hinglish"
          ? [
              "Yeh sabse important cheez dikh rahi hai.",
              "Maine check karke bataya hai.",
              "Aapke store data ka sabse clear read yeh hai.",
            ]
          : [
              "Here's what stands out.",
              "I checked that for you.",
              "This is the clearest read from your store data.",
            ];
    const introIndex =
      memoryRef.current.intentCounts[intent.id] ??
      Object.keys(memoryRef.current.intentCounts).length;
    const intro = introOptions[introIndex % introOptions.length];
    const previousIntent = memoryRef.current.lastIntentId;
    const localizedCopy =
      style === "english"
        ? null
        : LOCALIZED_INTENT_COPY[intent.id]?.[style];
    const relatedFollowUp =
      previousIntent === intent.id
        ? style === "hindi"
          ? `Aap isi ${intent.label} topic ko thoda aur explore kar rahe ho, to next useful step yahan ek level aur deeper jaana hoga.`
          : style === "hinglish"
            ? `Aap isi ${intent.label} topic ko thoda aur explore kar rahe ho, to next useful step yahan ek level aur deeper jaana hoga.`
            : `You've been digging into ${intent.label} a bit, so the next useful step would be to go one layer deeper here.`
        : null;

    memoryRef.current.lastIntentId = intent.id;
    memoryRef.current.intentCounts[intent.id] =
      (memoryRef.current.intentCounts[intent.id] ?? 0) + 1;

    return [
      intro,
      localizedCopy?.response ?? intent.response,
      relatedFollowUp ?? localizedCopy?.followUp ?? intent.followUp,
    ]
      .filter(Boolean)
      .join("\n\n");
  };

  const generateAIResponse = (userMessage: string): string => {
    const style = detectResponseStyle(userMessage);
    const matchingIntent = findIntentResponse(userMessage);

    if (matchingIntent) {
      return buildAdaptiveResponse(matchingIntent, style);
    }

    if (style === "hindi") {
      return "Main sales, customers, products, inventory, margin, cash flow aur forecast jaise business topics par help kar sakta hoon. Aap seedha pooch sakte hain, jaise \"kaunse items stockout ke kareeb hain?\" ya \"is month mere top customers kaun hain?\"";
    }

    if (style === "hinglish") {
      return "Main sales, customers, products, inventory, margin, cash flow aur forecast jaise business topics par help kar sakta hoon. Aap seedha pooch sakte ho, jaise \"kaunse items stockout ke kareeb hain?\" ya \"is month mere top customers kaun hain?\"";
    }

    return `I can help with sales, customers, products, inventory, margins, cash flow, and forecasts. Try asking in a direct business way, like "Which items are close to stockout?" or "Who are my top customers this month?" and I'll keep it sharp.`;
  };

  const toggleRecording = () => {
    if (!recognitionRef.current || !hasSpeechSupport) {
      toast.error("Voice input is not supported in this browser.");
      return;
    }

    if (isRecording) {
      shouldSendAfterRecordingRef.current = false;
      manualStopRef.current = true;
      recognitionRef.current.stop();
      toast.info("Voice recording stopped.");
      return;
    }

    try {
      recognitionRef.current.start();
      setIsRecording(true);
      setInterimTranscript("");
      toast.info("Listening for your question...");
    } catch {
      toast.error("Voice input could not start.");
    }
  };

  const handleSettings = () => {
    toast.info("Settings panel coming soon!");
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex w-80 flex-col border-r bg-muted/20">
        <div className="border-b p-6">
          <Logo
            iconClassName="h-6 w-6"
            className="mb-4"
            onClick={onNavigateToLanding}
            clickable={!!onNavigateToLanding}
          />
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{businessName}</p>
              <p className="text-sm text-muted-foreground">{isDemoUser ? "Demo Workspace" : "Customer Workspace"}</p>
            </div>
          </div>
        </div>

        <div className="border-b p-6">
          <h3 className="mb-3 font-medium">Today's Overview</h3>
          <div className="space-y-3">
            {quickStats.map((stat, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {stat.label}
                </span>
                <div className="text-right">
                  <p className="font-medium">{stat.value}</p>
                  <Badge
                    variant={stat.positive ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {stat.change}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 p-6">
          <h3 className="mb-3 font-medium">Quick Questions</h3>
          <div className="space-y-2">
            {quickQuestions.map((question, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                className="h-auto w-full justify-start p-2 text-left"
                onClick={() => handleSendMessage(question)}
              >
                <span className="text-xs">{question}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t p-6">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={onNavigateToDashboard}
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={onNavigateToSupport}
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            Support
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={handleSettings}
          >
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={onLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b bg-background p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold">Aska Chat</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {isDemoUser ? "Demo Data" : sourceConnected ? "Connected" : "Connect Your Data"}
              </Badge>
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToDashboard}
              >
                <BarChart3 className="mr-2 h-4 w-4" />
                View Dashboard
              </Button>
            </div>
          </div>
        </div>

        <ScrollArea ref={scrollAreaRef} className="flex-1 p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-4 ${
                  message.type === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback>
                    {message.type === "user" ? (
                      <User className="h-4 w-4" />
                    ) : (
                      ASSISTANT_NAME
                    )}
                  </AvatarFallback>
                </Avatar>
                <Card
                  className={`min-w-0 max-w-[80%] overflow-hidden ${
                    message.type === "user"
                      ? "bg-primary text-primary-foreground"
                      : ""
                  }`}
                >
                  <CardContent className="p-4">
                    {message.type === "ai" ? (
                      <ChatAnswer content={message.content} sql={message.sql} />
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    )}
                    <p className="mt-2 text-xs opacity-70">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-4">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback>{ASSISTANT_NAME}</AvatarFallback>
                </Avatar>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex gap-1">
                      <div className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"></div>
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t bg-background p-6">
          <div className="mx-auto max-w-4xl">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Input
                  value={isRecording && interimTranscript
                    ? `${inputValue}${inputValue && interimTranscript ? " " : ""}${interimTranscript}`
                    : inputValue}
                  onChange={(event) => {
                    setInputValue(event.target.value);
                    setInterimTranscript("");
                  }}
                  placeholder={
                    hasSpeechSupport
                      ? "Ask me about your business data or use the mic..."
                      : "Ask me about your business data..."
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleSendMessage(displayedInputValue);
                    }
                  }}
                  className="pr-12"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className={`absolute right-1 top-1 h-8 w-8 p-0 ${
                    isRecording ? "text-red-500" : ""
                  }`}
                  onClick={toggleRecording}
                  type="button"
                  aria-label={
                    isRecording ? "Stop voice input" : "Start voice input"
                  }
                >
                  {isRecording ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <Button
                onClick={() => handleSendMessage(displayedInputValue)}
                disabled={!inputValue.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {isRecording && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Listening... Speak your question and tap the mic again when
                you're done.
              </p>
            )}
            {!hasSpeechSupport && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                Voice input works in supported browsers like Chrome and Edge.
              </p>
            )}
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Try: "What were my sales yesterday?" or "Which items are low on stock?"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
