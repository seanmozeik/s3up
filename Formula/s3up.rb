class S3up < Formula
  desc "Fast CLI tool for uploading files to S3-compatible storage"
  homepage "https://github.com/seanmozeik/s3up"
  version "0.3.1"
  license "MIT"

  # URL to bundled source (single JS file)
  url "https://github.com/seanmozeik/s3up/releases/download/v#{version}/s3up-#{version}.tar.gz"
  sha256 "3b448e8f2f4b1c6ae032869651d7eab0ac6faedfd94b31037c22332b84cec735"

  depends_on "oven-sh/bun/bun"

  on_linux do
    depends_on "libsecret"
  end

  def install
    # Install all bundled files to libexec
    libexec.install Dir["*"]

    # Create wrapper script
    (bin/"s3up").write <<~EOS
      #!/bin/bash
      exec "#{Formula["bun"].opt_bin}/bun" "#{libexec}/index.js" "$@"
    EOS
  end

  test do
    assert_match "s3up", shell_output("#{bin}/s3up --help")
  end
end
