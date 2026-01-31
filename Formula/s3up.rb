class S3up < Formula
  desc "Fast CLI tool for uploading files to S3-compatible storage"
  homepage "https://github.com/seanmozeik/s3up"
  version "0.2.2"
  license "MIT"

  url "https://github.com/seanmozeik/s3up/releases/download/v#{version}/s3up-#{version}.tar.gz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"

  depends_on "oven-sh/bun/bun"

  on_linux do
    depends_on "libsecret"
  end

  def install
    libexec.install Dir["*"]
    (bin/"s3up").write_env_script "bun", libexec/"index.js"
  end

  test do
    assert_match "s3up", shell_output("#{bin}/s3up --help")
  end
end
