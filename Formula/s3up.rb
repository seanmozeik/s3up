# Homebrew formula for s3up - S3 file uploader
# To use: brew install seanmozeik/tap/s3up

class S3up < Formula
  desc "Fast CLI tool for uploading files to S3-compatible storage"
  homepage "https://github.com/seanmozeik/s3up"
  version "0.2.1"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/seanmozeik/s3up/releases/download/v#{version}/s3up-darwin-arm64.tar.gz"
      sha256 "902251d537e296ca3747807783fcb548654d1ca4f6bf27c0699b5f196e7842d4"
    else
      url "https://github.com/seanmozeik/s3up/releases/download/v#{version}/s3up-darwin-x64.tar.gz"
      sha256 "c976aa64fc0e8c0c3978a9e2b7f0c9b2e4fe734720ca5143ae5861068d36b341"
    end
  end

  on_linux do
    depends_on "libsecret"

    if Hardware::CPU.arm?
      url "https://github.com/seanmozeik/s3up/releases/download/v#{version}/s3up-linux-arm64.tar.gz"
      sha256 "fd21e144c1f558bcd219dd9a2c685b84137dabef43d4e198b28c163fdd3037bf"
    else
      url "https://github.com/seanmozeik/s3up/releases/download/v#{version}/s3up-linux-x64.tar.gz"
      sha256 "7c8605938f19aa75add428cd3c1a6242a03fb5495e2da141c3e6d16992843c57"
    end
  end

  def install
    if OS.mac?
      if Hardware::CPU.arm?
        bin.install "s3up-darwin-arm64" => "s3up"
      else
        bin.install "s3up-darwin-x64" => "s3up"
      end
    elsif OS.linux?
      if Hardware::CPU.arm?
        bin.install "s3up-linux-arm64" => "s3up"
      else
        bin.install "s3up-linux-x64" => "s3up"
      end
    end
  end

  test do
    assert_match "s3up", shell_output("#{bin}/s3up --help")
  end
end
