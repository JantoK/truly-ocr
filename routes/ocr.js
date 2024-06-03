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
async function extractInformation(data) {
  const pattern = /公民身份号码|公民|身份|号码/g;
  const addressPattern = /公民身份号码|公民身份|身份号码|姓名|民族|性别|出生/g;

  const info = {
    name: "",
    gender: "",
    ethnic: "",
    birth: "",
    address: "",
    id: "",
  };

  let foundName = false;
  let foundGender = false;
  let foundEthnic = false;
  let foundBirth = false;
  let foundId = false;

  await data.forEach((item) => {
    const text = item.text;
    // 提取名字
    if (!foundName && text.includes("姓名")) {
      const nameIndex = text.indexOf("姓名");
      info["name"] = text.substring(nameIndex + 2).trim();
      foundName = true;
    }
    // 提取性别
    if (!foundGender && text.includes("性别")) {
      const genderIndex = text.indexOf("性别");
      info["gender"] = text.substring(genderIndex + 2, genderIndex + 3).trim();
      foundGender = true;
    }
    // 提取民族
    if (!foundEthnic && text.includes("民族")) {
      const ethnicIndex = text.indexOf("民族");
      info["ethnic"] = text.substring(ethnicIndex + 2).trim();
      foundEthnic = true;
    }
    // 提取出生
    if (!foundBirth && text.includes("出生")) {
      const birthIndex = text.indexOf("出生");
      const birthEndIndex = text.indexOf("日");
      info["birth"] = text
        .substring(
          birthIndex + 2,
          birthEndIndex === -1 ? birthIndex + 13 : birthEndIndex + 1
        )
        .trim();
      foundBirth = true;
    }
    // 提取身份证
    if (!foundId && pattern.test(text)) {
      console.log("进入基础循环")
      console.log(text)
      const match = text.match(/\d{10,}[Xx]?/g);
      console.log('match: ', match);
      if(match) {
        info["id"] = match[0]
        foundId = true;
      }
    }
  });

  // 高级查找
  // 单字姓名
  if(!foundName) {
    for(let i = 0; i < data.length; i++) {
        const text = data[i].text;
        if (text.includes("姓")||text.includes("名")) {
            if(text.includes("姓")) {
                const nameIndex = text.indexOf("姓");
                info["name"] = text.substring(nameIndex + 2).trim();
             }
             if(text.includes("名")) {
                 const nameIndex = text.indexOf("名");
                 info["name"] = text.substring(nameIndex + 1).trim();
             }
             foundName = true;
             break;
        }
    }
  }

  // 高级查找性别
  if(!foundGender) {
    for(let i = 0; i < data.length; i++) {
        const text = data[i].text;
        if (text.includes("男")||text.includes("女")) {
            info["gender"] = text.includes("男")?'男':'女'
            foundGender = true;
            break;
        }
    }
  }

  // 高级查找id
  if(!foundId) {
    console.log("进入高级循环")
    for(let i = 0; i < data.length; i++) {
        const text = data[i].text;
        const match = text.match(/\d{10,}[Xx]?/g);
        console.log('match: ', match);
        if(match) {
        info["id"] = match[0]
        foundId = true;
        break;
      }
    }
  }

  // 只查到民族，高级查找性别
  if (!foundGender && foundEthnic) {
    await data.forEach((item) => {
      const text = item.text;
      if (text.includes("民族")) {
        info["gender"] = text
          .substring(text.indexOf("民族") - 1, text.indexOf("民族"))
          .trim();
      }
    });
  }
  // 只查找到性别，高级查找民族
  if (foundGender && !foundEthnic) {
    console.log('高级查找民族')
    await data.forEach((item) => {
      const text = item.text;
      if (text.includes(info["gender"])) {
        info["ethnic"] = text.substring( text.indexOf(info["gender"]) + 3 ) .trim();
      }
    });
  }

  // 提取地址
  await data.forEach((item) => {
    const text = item.text;
    // 优先匹配完整
    if (text.includes("住址")) {
      let address = "";
      for (let i = data.indexOf(item); i < data.length; i++) {
        address += data[i].text.replace("住址", "").trim() + "";
        // 如果下一行含有“身份信息”，则中断然后舍弃
        if (data[i + 1] && addressPattern.test(data[i + 1].text)) {
          break;
        }
      }
      info["address"] = address;
    }
    if (text.includes("住")||text.includes("址")) {
        let address = "";
        let keyword = text.includes("住")?"住":"址"
        for (let i = data.indexOf(item); i < data.length; i++) {
          address += data[i].text.replace(keyword, "").trim() + "";
          // 如果下一行含有“身份信息”，则中断然后舍弃
          if (data[i + 1] && addressPattern.test(data[i + 1].text)) {
            break;
          }
        }
        info["address"] = address;
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

      if (data.code === 100) {
        // 合并一行后的Text
        const tempMergeText = mergeText(data.data);
        console.log('tempMergeText: ', tempMergeText);
        // 提取后的数组
        const extractInfo = await extractInformation(tempMergeText);
        console.log(extractInfo);
        // 字符串数组
        // const textArray = tempMergeText.map((item) => item.text);
        return res.status(200).send({
          code: 200,
          message: "提取成功",
          data: {
            // infoDetail: textArray,
            extract: extractInfo
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
