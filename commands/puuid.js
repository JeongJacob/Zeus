const { SlashCommandBuilder } = require("discord.js");
const fetch = require("node-fetch");
require("dotenv").config();

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const REGION_ROUTING = "asia";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("id")
        .setDescription("라이엇 ID를 기반으로 PUUID를 조회합니다.")
        .addStringOption((option) =>
            option.setName("riotid").setDescription("Riot ID와 태그라인 (예: 닉네임#KR1)").setRequired(true)
        ),

    async execute(interaction) {
        const riotId = interaction.options.getString("riotid").trim();

        if (!riotId.includes("#")) {
            return interaction.reply({
                content: "❌ Riot ID 형식이 잘못되었습니다.\n예: `닉네임#KR1`",
                ephemeral: true,
            });
        }

        const [gameName, tagLine] = riotId.split("#").map((str) => str.trim());

        if (!gameName || !tagLine) {
            return interaction.reply({
                content: "❌ 닉네임 또는 태그라인이 비어있습니다.\n예: `닉네임#KR1`",
                ephemeral: true,
            });
        }

        const encodedGameName = encodeURIComponent(gameName);
        const encodedTagLine = encodeURIComponent(tagLine);

        const url = `https://${REGION_ROUTING}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodedGameName}/${encodedTagLine}?api_key=${RIOT_API_KEY}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (!response.ok) {
                console.error("❌ Riot API 오류:", data);
                return interaction.reply({
                    content: `❌ Riot API 요청 실패: ${data.status?.message || "알 수 없는 오류"}`,
                    ephemeral: true,
                });
            }

            return interaction.reply(
                `🔍 **Riot ID**: \`${gameName}#${tagLine}\`\n` +
                    `🧬 **PUUID**: \`${data.puuid}\`\n\n` +
                    `이제 \`/전적 ${data.puuid}\` 형식으로 전적을 조회할 수 있습니다.`
            );
        } catch (err) {
            console.error("❌ fetch 오류:", err);
            return interaction.reply({
                content: "❌ Riot API 호출 중 예기치 못한 오류가 발생했습니다.",
                ephemeral: true,
            });
        }
    },
};
