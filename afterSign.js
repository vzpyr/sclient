const { execSync } = require("child_process");

exports.default = async function (context) {
  const platform = context.electronPlatformName;
  if (platform !== "win32" && platform !== "darwin") return;

  try {
    execSync(`python3 -m castlabs_evs.vmp sign-pkg "${context.appOutDir}"`, {
      stdio: "inherit",
    });
  } catch {}
};
