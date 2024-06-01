var express = require("express");
var router = express.Router();

const OCR = require("paddleocrjson");
const multer = require("multer");
const upload = multer(); // 使用默认配置

// 将误差y小于10px的合并成一行
function mergeText(data) {
  let mergedData = [];
  let currentText = "";

  for (let i = 0; i < data.length; i++) {
    const currentBox = data[i].box[0]; // 获取当前对象的 box 数组中的第一个坐标数组
    const currentY = currentBox[1]; // 获取当前对象的 Y 轴坐标

    if (i < data.length - 1) {
      const nextBox = data[i + 1].box[0]; // 获取下一个对象的 box 数组中的第一个坐标数组
      const nextY = nextBox[1]; // 获取下一个对象的 Y 轴坐标

      if (nextY - currentY <= 10) {
        currentText += data[i].text; // 合并相邻对象的 text
      } else {
        currentText += data[i].text; // 将当前对象的 text 添加到合并文本中
        mergedData.push({ text: currentText }); // 将合并后的文本添加到新数组中
        currentText = ""; // 重置当前文本
      }
    } else {
      currentText += data[i].text; // 处理最后一个对象的 text
      mergedData.push({ text: currentText }); // 将最后一个文本添加到新数组中
    }
  }
  return mergedData;
}

// 提取关键信息
function extractInformation(data) {
  const info = {
    name: "",
    gender: "",
    ethnic: "",
    birth: "",
    address: "",
    id: "",
  };

  let foundName = false;
  let foundBirth = false;
  let foundGenderAndEthnic = false;
  let foundAddress = false;

  data.forEach((item) => {
    const text = item.text;
    const pattern = /公民身份号码|公民|身份|号码/g;
    if (!foundName && text.includes("姓名")) {
      info["name"] = text.replace("姓名", "").trim();
      foundName = true;
    } else if (
      !foundGenderAndEthnic &&
      (text.includes("性别") || text.includes("民族"))
    ) {
      const genderAndNation = text.replace("性别", "").trim();
      // 获取性别
      if (text.includes("女") || text.includes("男")) {
        info["gender"] = text.includes("女") ? "女" : "男";
        info["ethnic"] = text.substring(text.includes(info["gender"]) + 4).trim();
      } else {
        const genderIndex = genderAndNation.indexOf("民族");
        if (genderIndex !== -1) {
          info["ethnic"] = genderAndNation.substring(genderIndex + 2).trim();
        }
      }
      foundGenderAndEthnic = true;
    } else if (!foundBirth && text.includes("出生")) {
      info["birth"] = text.replace("出生", "").trim();
      foundBirth = true;
    } else if (!foundAddress && text.includes("住址")) {
      let address = "";
      for (let i = data.indexOf(item); i < data.length; i++) {
        address += data[i].text.replace("住址", "").trim() + "";
        if (data[i + 1] && pattern.test(data[i + 1].text)) {
          break;
        }
      }
      info["address"] = address.trim();
      foundAddress = true;
    } else if (pattern.test(text)) {
      const match = text.match(/\d.*/);
      info["id"] = match[0];
    }
  });

  return info;
}

router.post(
  "/idCard",
  upload.single("imgFile"),
  async function (req, res, next) {
    try {
      // 图片文件
      const imgFile = req.file;
      console.log("imgFile: ", imgFile);
      if (!imgFile) {
        return res.status(400).send({
          code: 400,
          message: "上传参数不正确",
        });
      }
      const imgBuffer = imgFile.buffer;
      const imgBase64 = imgBuffer.toString("base64");

      // ocr
      const ocr = new OCR(
        "PaddleOCR-json.exe",
        [],
        {
          cwd: "./PaddleOCR-json",
        },
        true
      );

      // 添加await
      const data = await ocr.flush({ image_base64: imgBase64 });
      console.log("data: ", data);

      if (data.code === 100) {
        // 合并一行后的Text
        const tempMergeText = mergeText(data.data);
        // 提取后的数组
        const extractInfo = extractInformation(tempMergeText);
        console.log(extractInfo);
        // 字符串数组
        const textArray = tempMergeText.map((item) => item.text);
        return res.status(200).send({
          code: 200,
          message: "提取成功",
          data: {
            infoDetail: textArray,
            extract: extractInfo,
          },
        });
      } else {
        return res.status(200).send({
          code: 400,
          message: "提取失败",
          data: {},
        });
      }
    } catch (e) {
      console.log(e);
      return res.status(500).send({
        code: 500,
        message: "服务器错误",
        data: e,
      });
    }
  }
);

module.exports = router;
