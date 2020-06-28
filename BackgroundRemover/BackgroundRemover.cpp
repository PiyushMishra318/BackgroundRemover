// ConsoleApplication1.cpp : This file contains the 'main' function. Program execution begins and ends there.
//

#include<opencv2/opencv.hpp>
#include <opencv2/imgproc.hpp>
#include <opencv2/highgui.hpp>
#include<iostream>
using namespace std;
using namespace cv;

int main(int argc, char** argv)
{
	Mat src = imread("input.jpg");  // This code will automatically loads image to Mat with 3-channel(BGR) format

// 2. Grayscaling
	Mat gray;
	cvtColor(src, gray, COLOR_BGR2GRAY);   // This will convert BGR src to GRAY

	// 3. Thresholding
	Mat mask;
	threshold(gray, mask, 100, 255, THRESH_BINARY); // Or use CV_THRES_BINARY_INV for inverting result

	// 4. Splitting & adding Alpha
	vector<Mat> channels;   // C++ version of ArrayList<Mat>
	split(src, channels);   // Automatically splits channels and adds them to channels. The size of channels = 3
	channels.push_back(mask);   // Adds mask(alpha) channel. The size of channels = 4

	// 5. Merging
	Mat dst;
	merge(channels, dst);   // dst is created with 4-channel(BGRA).
	// Note that OpenCV applies BGRA by default if your array size is 4,
	// even if actual order is different. In this case this makes sense.

	// 6. Saving
	namedWindow("Output", WINDOW_NORMAL);
	imshow("Output", dst);
	waitKey(0);
}