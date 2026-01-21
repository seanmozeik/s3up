# Homebrew formula for s3up - S3 file uploader
# To use: brew install seanmozeik/tap/s3up

class S3up < Formula
  desc "Fast CLI tool for uploading files to S3-compatible storage"
  homepage "https://github.com/seanmozeik/s3up"
  version "0.1.5"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/seanmozeik/s3up/releases/download/v#{version}/s3up-darwin-arm64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    else
      url "https://github.com/seanmozeik/s3up/releases/download/v#{version}/s3up-darwin-x64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
  end

  on_linux do
    depends_on "libsecret"

    if Hardware::CPU.arm?
      url "https://github.com/seanmozeik/s3up/releases/download/v#{version}/s3up-linux-arm64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    else
      url "https://github.com/seanmozeik/s3up/releases/download/v#{version}/s3up-linux-x64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
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
