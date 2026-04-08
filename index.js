// 🔥 STEP 1: Normalize each video
const normIntro = `norm_intro_${jobId}.mp4`;
const normMain = `norm_main_${jobId}.mp4`;
const normOutro = `norm_outro_${jobId}.mp4`;

const normalize = (input, output) =>
  `/usr/bin/ffmpeg -y -i "${input}" \
  -vf "scale=1280:720,fps=30,format=yuv420p" \
  -c:v libx264 -preset veryfast \
  -c:a aac -ar 44100 -ac 2 \
  -movflags +faststart \
  "${output}"`;

// Run normalization sequentially
exec(normalize(introPath, normIntro), (err) => {
  if (err) return console.error("Intro normalize error:", err);

  exec(normalize(mainPath, normMain), (err) => {
    if (err) return console.error("Main normalize error:", err);

    exec(normalize(outroPath, normOutro), (err) => {
      if (err) return console.error("Outro normalize error:", err);

      // 🔥 STEP 2: CONCAT (safe now)
      fs.writeFileSync(
        `files_${jobId}.txt`,
        `file '${normIntro}'\nfile '${normMain}'\nfile '${normOutro}'`
      );

      const concatCmd = `/usr/bin/ffmpeg -y \
      -f concat -safe 0 \
      -i files_${jobId}.txt \
      -c copy \
      "${outputPath}"`;

      exec(concatCmd, (err, stdout, stderr) => {
        console.log("Concat stdout:", stdout);
        console.log("Concat stderr:", stderr);

        if (err) {
          jobs[jobId] = { status: "error" };
          console.error("Concat error:", err);
          return;
        }

        jobs[jobId] = {
          status: "done",
          file: outputPath,
        };

        console.log("Job completed:", jobId);
      });
    });
  });
});
