const fs = require("fs-extra");
const axios = require("axios");
const request = require("request");

function loadAutoLinkStates() {
  try {
    const data = fs.readFileSync("autolink.json", "utf8");
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

function saveAutoLinkStates(states) {
  fs.writeFileSync("autolink.json", JSON.stringify(states, null, 2));
}

let autoLinkStates = loadAutoLinkStates();

module.exports = {
  config: {
    name: "autolink",
    version: "2.0",
    author: "AminulSordar",
    countDown: 5,
    role: 0,
    shortDescription: "Auto-download and send videos with title",
    category: "media",
  },

  onStart: async function ({ api, event, args }) {
    const threadID = event.threadID;
    const state = autoLinkStates[threadID] || false;

    if (!args[0]) {
      return api.sendMessage(
        `📺 AutoLink বর্তমানে ${state ? "🔛 চালু আছে" : "🔴 বন্ধ আছে"}\n\nব্যবহারঃ\n→ autolink on\n→ autolink off`,
        threadID
      );
    }

    if (args[0].toLowerCase() === "on") {
      autoLinkStates[threadID] = true;
      saveAutoLinkStates(autoLinkStates);
      return api.sendMessage("✅ AutoLink সিস্টেম চালু করা হয়েছে!", threadID);
    }

    if (args[0].toLowerCase() === "off") {
      autoLinkStates[threadID] = false;
      saveAutoLinkStates(autoLinkStates);
      return api.sendMessage("❌ AutoLink সিস্টেম বন্ধ করা হয়েছে!", threadID);
    }

    api.sendMessage("⚠️ ব্যবহারঃ autolink on/off", threadID);
  },

  onChat: async function ({ api, event }) {
    const threadID = event.threadID;

    // যদি AutoLink বন্ধ থাকে, কিছু করবে না
    if (!autoLinkStates[threadID]) return;

    const message = event.body;
    const linkMatch = message.match(/(https?:\/\/[^\s]+)/);
    if (!linkMatch) return;

    const url = linkMatch[0];
    api.setMessageReaction("⏳", event.messageID, () => {}, true);

    try {
      const res = await axios.get(`https://nayan-video-downloader.vercel.app/alldown?url=${encodeURIComponent(url)}`);

      if (!res.data.data || (!res.data.data.high && !res.data.data.low)) {
        return api.sendMessage("⚠️ ভিডিও ডাউনলোড লিংক পাওয়া যায়নি!", threadID, event.messageID);
      }

      const { title, high, low } = res.data.data;
      const msg = `🎬 《 TITLE 》: ${title}`;
      const videoUrl = high || low;

      request(videoUrl)
        .pipe(fs.createWriteStream("video.mp4"))
        .on("close", () => {
          api.sendMessage(
            {
              body: msg,
              attachment: fs.createReadStream("video.mp4"),
            },
            threadID,
            () => {
              fs.unlinkSync("video.mp4");
              api.setMessageReaction("✅", event.messageID, () => {}, true);
            }
          );
        });
    } catch (err) {
      console.error("Error fetching video:", err);
      api.sendMessage("❌ Error while fetching video. Please try again later.", threadID, event.messageID);
      api.setMessageReaction("❌", event.messageID, () => {}, true);
    }
  },
};
