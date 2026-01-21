# Homebrew formula for s3up - S3 file uploader
# To use: brew install seanmozeik/tap/s3up

class S3up < Formula
  desc "Fast CLI tool for uploading files to S3-compatible storage"
  homepage "https://github.com/seanmozeik/s3up"
  version "0.2.0"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/seanmozeik/s3up/releases/download/v#{version}/s3up-darwin-arm64.tar.gz"
      sha256 "6a45ceba33457536321e71c2f4c03774cdda55a6c095a482c2655e9dc85496aa"
    else
      url "https://github.com/seanmozeik/s3up/releases/download/v#{version}/s3up-darwin-x64.tar.gz"
      sha256 "f7a6d69b23fe2dd5416133cbb1c911f7de5495e16c988fb0e8728a749c711d78"
    end
  end

  on_linux do
    depends_on "libsecret"

    if Hardware::CPU.arm?
      url "https://github.com/seanmozeik/s3up/releases/download/v#{version}/s3up-linux-arm64.tar.gz"
      sha256 "37c46c7847220c956adb621be30ed66e9cc66dd718f4887c445fdc099553fa04"
    else
      url "https://github.com/seanmozeik/s3up/releases/download/v#{version}/s3up-linux-x64.tar.gz"
      sha256 "22d65d6be716c2ab08f2a19984f3ba754d738cb1350bc8f64f77cbd005ead5be"
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
