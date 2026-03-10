const { Client, GatewayIntentBits, Collection } = require("discord.js");
require("dotenv").config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.commands = new Collection();

// 명령어 불러오기
const puuid = require("./commands/puuid");
const match = require("./commands/match");
const clear = require("./commands/clear");
const help = require("./commands/help");

client.commands.set(puuid.data.name, puuid);
client.commands.set(match.data.name, match);
client.commands.set(clear.data.name, clear);
client.commands.set(help.data.name, help);

// 파티 / 내전 핸들러
const setupPartyHandlers = require("./commands/party");
const { setupScrimHandlers } = require("./commands/scrim");

setupPartyHandlers(client);
setupScrimHandlers(client);

// 슬래시 명령어 정의
const { SlashCommandBuilder } = require("discord.js");

const slashCommands = [
  new SlashCommandBuilder()
    .setName("자랭")
    .setDescription("게임 모집을 시작합니다."),

  new SlashCommandBuilder()
    .setName("내전")
    .setDescription("내전을 모집합니다."),

  puuid.data,
  match.data,
  clear.data,
  help.data,
].map((cmd) => cmd.toJSON());

// 봇 준비
client.once("ready", async () => {
  console.log(`로그인됨: ${client.user.tag}`);

  try {
    await client.application.commands.set(slashCommands);

    console.log("슬래시 명령어 동기화 완료 (모든 서버)");
  } catch (err) {
    console.error("명령어 등록 실패:", err);
  }
});

// 슬래시 명령어 실행
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);

    if (!interaction.replied) {
      await interaction.reply({
        content: "명령어 실행 중 오류가 발생했습니다.",
        flags: 64,
      });
    }
  }
});

client.login(process.env.TOKEN);
