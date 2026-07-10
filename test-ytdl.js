const ytdlexec = require("youtube-dl-exec");
const ytdl = ytdlexec.create(ytdlexec.constants.YOUTUBE_DL_PATH);
const proc = ytdl.exec("https://soundcloud.com/monstercat/bad-computer-riddle", {
	extractAudio: true,
	audioFormat: "best",
	noWarnings: true
});
proc.stdout.on("data", data => console.log("STDOUT:", data.toString()));
proc.stderr.on("data", data => console.log("STDERR:", data.toString()));
