const fetch = require("node-fetch");

let championIdMap = null;

async function getChampionIdMap() {
    if (championIdMap) return championIdMap;

    try {
        const versionRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
        const versions = await versionRes.json();
        const latestVersion = versions[0];

        const champRes = await fetch(
            `https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/ko_KR/champion.json`
        );
        const champData = await champRes.json();

        championIdMap = {};
        for (const champKey in champData.data) {
            const champ = champData.data[champKey];
            championIdMap[parseInt(champ.key, 10)] = champ.name;
        }

        return championIdMap;
    } catch (error) {
        console.error("❌ 챔피언 정보 로딩 실패:", error);
        return {};
    }
}

module.exports = { getChampionIdMap };
