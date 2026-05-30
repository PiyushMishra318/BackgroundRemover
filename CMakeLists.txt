cmake_minimum_required(VERSION 3.16)
project(threshold-bg-cutout VERSION 2.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(OpenCV REQUIRED COMPONENTS core imgproc imgcodecs highgui)

add_executable(bg-cutout src/main.cpp)
target_link_libraries(bg-cutout PRIVATE ${OpenCV_LIBS})
target_include_directories(bg-cutout PRIVATE ${OpenCV_INCLUDE_DIRS})

enable_testing()
add_test(NAME help COMMAND bg-cutout --help)
add_test(
  NAME integration
  COMMAND bg-cutout ${CMAKE_SOURCE_DIR}/fixtures/sample.jpg ${CMAKE_BINARY_DIR}/test-output.png --threshold 100 --invert
)
