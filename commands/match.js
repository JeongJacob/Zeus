const { SlashCommandBuilder } = require("@discordjs/builders");
const { EmbedBuilder } = require("discord.js");
const fetch = require("node-fetch");
require("dotenv").config();
const { getChampionIdMap } = require("../utils/champion");

const RIOT_API_KEY = process.env.RIOT_API_KEY;
const REGION_ROUTING = "asia";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("전적")
        .setDescription("소환사의 최근 한 판 전적을 조회합니다.")
        .addStringOption((option) => option.setName("puuid").setDescription("조회할 소환사의 puuid").setRequired(true)),

    async execute(interaction) {
        const puuid = interaction.options.getString("puuid");

        try {
            const championIdMap = await getChampionIdMap();

            // 1. 최근 매치 ID 조회
            const matchListRes = await fetch(
                `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=1&api_key=${RIOT_API_KEY}`
            );
            if (!matchListRes.ok) throw new Error("매치 ID를 가져올 수 없습니다.");
            const [matchId] = await matchListRes.json();

            // 2. 매치 상세 정보
            const matchRes = await fetch(
                `https://${REGION_ROUTING}.api.riotgames.com/lol/match/v5/matches/${matchId}?api_key=${RIOT_API_KEY}`
            );
            if (!matchRes.ok) throw new Error("매치 정보를 가져올 수 없습니다.");
            const matchData = await matchRes.json();
            const participants = matchData.info.participants;
            const teams = matchData.info.teams;

            // 블루팀 & 레드팀 정리
            const blueTeam = participants
                .slice(0, 5)
                .map((p) => {
                    const champ = championIdMap[p.championId] || "Unknown";
                    const riotName =
                        p.riotIdGameName && p.riotIdTagline ? `${p.riotIdGameName}#${p.riotIdTagline}` : "Unknown";
                    return `• ${riotName} - ${champ}\nK/D/A: ${p.kills}/${p.deaths}/${p.assists} ${
                        p.win ? "🟦 승리" : "🔻 패배"
                    }`;
                })
                .join("\n\n");

            const redTeam = participants
                .slice(5, 10)
                .map((p) => {
                    const champ = championIdMap[p.championId] || "Unknown";
                    const riotName =
                        p.riotIdGameName && p.riotIdTagline ? `${p.riotIdGameName}#${p.riotIdTagline}` : "Unknown";
                    return `• ${riotName} - ${champ}\nK/D/A: ${p.kills}/${p.deaths}/${p.assists} ${
                        p.win ? "🟥 승리" : "🔻 패배"
                    }`;
                })
                .join("\n\n");

            // 밴 정보
            const blueBans = teams[0]?.bans.map((b) => championIdMap[b.championId] || "Unknown").join(", ") || "없음";
            const redBans = teams[1]?.bans.map((b) => championIdMap[b.championId] || "Unknown").join(", ") || "없음";

            // 임베드 생성
            const embed = new EmbedBuilder()
                .setTitle("📘 최근 전적 요약")
                .setDescription(`경기 ID: \`${matchId}\``)
                .addFields(
                    { name: "🔹 블루팀", value: blueTeam, inline: false },
                    { name: "🔸 레드팀", value: redTeam, inline: false },
                    { name: "🚫 밴 정보", value: `블루팀: ${blueBans}\n레드팀: ${redBans}`, inline: false }
                )
                .setColor(0x3498db)
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        } catch (err) {
            console.error("❌ 전적 조회 중 오류:", err);
            return interaction.reply("❌ 전적을 불러오는 중 오류가 발생했습니다. puuid가 정확한지 확인해주세요.");
        }
    },
};
