#include <opencv2/opencv.hpp>

#include <iostream>
#include <string>

namespace {

struct Options {
  std::string input = "input.jpg";
  std::string output = "output.png";
  int threshold = 100;
  bool invert = false;
  bool preview = false;
};

void printUsage(const char* program) {
  std::cerr
      << "Usage: " << program
      << " [input] [output] [options]\n\n"
      << "Remove a solid background using grayscale thresholding and write a BGRA PNG.\n\n"
      << "Options:\n"
      << "  -i, --input <path>       Input image (default: input.jpg)\n"
      << "  -o, --output <path>      Output PNG with alpha (default: output.png)\n"
      << "  -t, --threshold <0-255>  Threshold value (default: 100)\n"
      << "      --invert             Use inverse threshold mask\n"
      << "      --preview            Show result window before exit\n"
      << "  -h, --help               Show help\n";
}

Options parseArgs(int argc, char** argv) {
  Options opts;

  for (int i = 1; i < argc; ++i) {
    const std::string arg = argv[i];

    if (arg == "-h" || arg == "--help") {
      printUsage(argv[0]);
      std::exit(0);
    }
    if ((arg == "-i" || arg == "--input") && i + 1 < argc) {
      opts.input = argv[++i];
      continue;
    }
    if ((arg == "-o" || arg == "--output") && i + 1 < argc) {
      opts.output = argv[++i];
      continue;
    }
    if ((arg == "-t" || arg == "--threshold") && i + 1 < argc) {
      opts.threshold = std::stoi(argv[++i]);
      continue;
    }
    if (arg == "--invert") {
      opts.invert = true;
      continue;
    }
    if (arg == "--preview") {
      opts.preview = true;
      continue;
    }

    if (opts.input == "input.jpg") {
      opts.input = arg;
    } else if (opts.output == "output.png") {
      opts.output = arg;
    } else {
      throw std::runtime_error("Unexpected argument: " + arg);
    }
  }

  return opts;
}

cv::Mat removeBackground(const cv::Mat& src, int threshold, bool invert) {
  cv::Mat gray;
  cv::cvtColor(src, gray, cv::COLOR_BGR2GRAY);

  cv::Mat mask;
  const int mode = invert ? cv::THRESH_BINARY_INV : cv::THRESH_BINARY;
  cv::threshold(gray, mask, threshold, 255, mode);

  std::vector<cv::Mat> channels;
  cv::split(src, channels);
  channels.push_back(mask);

  cv::Mat dst;
  cv::merge(channels, dst);
  return dst;
}

}  // namespace

int main(int argc, char** argv) {
  try {
    const Options opts = parseArgs(argc, argv);

    const cv::Mat src = cv::imread(opts.input, cv::IMREAD_COLOR);
    if (src.empty()) {
      std::cerr << "Error: could not read input image: " << opts.input << '\n';
      return 1;
    }

    const cv::Mat dst = removeBackground(src, opts.threshold, opts.invert);

    if (!cv::imwrite(opts.output, dst)) {
      std::cerr << "Error: could not write output image: " << opts.output << '\n';
      return 1;
    }

    std::cout << "Wrote " << opts.output << '\n';

    if (opts.preview) {
      cv::namedWindow("BackgroundRemover", cv::WINDOW_NORMAL);
      cv::imshow("BackgroundRemover", dst);
      cv::waitKey(0);
    }

    return 0;
  } catch (const std::exception& ex) {
    std::cerr << "Error: " << ex.what() << '\n';
    return 1;
  }
}
