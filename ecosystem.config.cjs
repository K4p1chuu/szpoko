module.exports = {
  apps : [
    {
      name   : "wsp-mdt-backend",
      script : "./server.js",
      watch: true // Opcjonalnie: automatycznie restartuje serwer po zmianach w plikach
    },
    {
      name   : "discord-bot",
      script : "./discord-bot/index.js",
      watch: true // Opcjonalnie: automatycznie restartuje bota po zmianach w plikach
    }
  ]
}