export const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const FORMULA_HEADER = [
  "class Codependence < Formula",
  '  desc "Enforce dependency version policy across projects, workspaces, and CI"',
  '  homepage "https://jeffry.in/codependence/"',
];
export const FORMULA_BODY = [
  '  license "MIT"',
  "",
  '  depends_on "node"',
  "",
  "  def install",
  '    system "npm", "install", *std_npm_args, "--ignore-scripts"',
  '    bin.install_symlink libexec.glob("bin/*")',
  "  end",
  "",
  "  test do",
  '    system bin/"codependence", "--help"',
  '    system bin/"cdp", "--help"',
  "  end",
  "end",
];
