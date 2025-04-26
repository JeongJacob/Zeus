const { Client, GatewayIntentBits, Collection } = require("discord.js");
const { clientId, guildIds } = require("./config.json"); // config.json에 클라이언트 ID와 서버 ID 배열 추가
require("dotenv").config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

console.log("DISCORD_TOKEN:", process.env.TOKEN); // 혹은 process.env.TOKEN
client
    .login(process.env.TOKEN)
    .then(() => console.log("Logged in!"))
    .catch((err) => console.error("Login failed: ", err));

// 명령어 파일들
const getPuuidCommand = require("./commands/puuid");
const handleMatchCommand = require("./commands/match");
const setupPartyHandlers = require("./commands/party");
const handleHelpCommand = require("./commands/help");

// 명령어 컬렉션
client.commands = new Collection();
client.commands.set(getPuuidCommand.data.name, getPuuidCommand);
client.commands.set(handleMatchCommand.data.name, handleMatchCommand);
client.commands.set(handleHelpCommand.data.name, handleHelpCommand);

// 봇 로그인 및 슬래시 명령어 등록
client.once("ready", async () => {
    console.log(`✅ 로그인됨: ${client.user.tag}`);

    try {
        // 명령어 등록 전에 기존 명령어가 있는지 확인하고 덮어쓰지 않도록 함
        const existingCommands = await client.application.commands.fetch();
        const commandsToRegister = client.commands.map((command) => command.data.toJSON());

        // 새로 등록할 명령어들만 필터링
        const commandsToCreate = commandsToRegister.filter(
            (command) => !existingCommands.some((existingCommand) => existingCommand.name === command.name)
        );

        // 여러 서버에 명령어 등록 (guildIds 배열 사용)
        if (guildIds && guildIds.length > 0) {
            for (const guildId of guildIds) {
                if (commandsToCreate.length > 0) {
                    await client.application.commands.set(commandsToCreate, guildId);
                    console.log(`✅ 서버 ${guildId}에 슬래시 명령어 등록 완료`);
                } else {
                    console.log(`✅ 서버 ${guildId}에는 이미 모든 명령어가 등록되어 있습니다.`);
                }
            }
        } else {
            // 글로벌 명령어 등록
            if (commandsToCreate.length > 0) {
                await client.application.commands.set(commandsToCreate);
                console.log("✅ 글로벌 슬래시 명령어 등록 완료");
            } else {
                console.log("✅ 모든 명령어가 이미 등록되어 있습니다.");
            }
        }
    } catch (error) {
        console.error("❌ 명령어 등록 중 오류 발생:", error);
    }
});

// interactionCreate 이벤트 처리
client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (err) {
        console.error("❌ 명령어 실행 오류:", err);
        await interaction.reply({
            content: "❌ 명령어 실행 중 오류가 발생했습니다. 다시 시도해주세요.",
            ephemeral: true,
        });
    }
});

// 파티 관련 핸들러
setupPartyHandlers(client);

// 봇 로그인
client.login(process.env.TOKEN).catch((err) => {
    console.error("❌ 봇 로그인 실패:", err);
    process.exit(1); // 로그인 실패 시 프로세스 종료
});
