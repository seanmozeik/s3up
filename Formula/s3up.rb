class S3up < Formula
  desc "Fast CLI tool for uploading files to S3-compatible storage"
  homepage "https://github.com/seanmozeik/s3up"
  version "0.3.0"
  license "MIT"

  # URL to bundled source (single JS file)
  url "https://github.com/seanmozeik/s3up/releases/download/v#{version}/s3up-#{version}.tar.gz"
  sha256 "1a6d7f6d094963399f4274c98339a2debdcc6089508706e7fab537b2ea58d882"

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
