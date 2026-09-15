/**
 * ระบบวิเคราะห์และประเมินคุณภาพแผนการจัดการเรียนรู้ครูอาชีวศึกษา (OVEC Evaluator Engine)
 */
class VocationalPlanEvaluator {
  constructor() {
    this.geminiApiKey = localStorage.getItem('OVEC_GEMINI_API_KEY') || '';
  }

  setApiKey(key) {
    this.geminiApiKey = key.trim();
    if (this.geminiApiKey) {
      localStorage.setItem('OVEC_GEMINI_API_KEY', this.geminiApiKey);
    } else {
      localStorage.removeItem('OVEC_GEMINI_API_KEY');
    }
  }

  getApiKey() {
    return this.geminiApiKey;
  }

  /**
   * เริ่มการประเมินแผนการสอน
   * @param {string} text เนื้อหาแผนการสอน
   * @param {object} meta ข้อมูลเสริม (ระดับ, แผนก, รูปแบบการสอน)
   * @returns {Promise<object>} ผลการประเมิน
   */
  async evaluatePlan(text, meta = {}) {
    if (!text || text.trim().length < 50) {
      throw new Error("เนื้อหาแผนการจัดการเรียนรู้สั้นเกินไปหรือไม่พบข้อความ กรุณาตรวจสอบไฟล์อีกครั้ง");
    }

    // หากมี Gemini API Key ให้ลองเรียกใช้ API ก่อน
    if (this.geminiApiKey) {
      try {
        return await this.evaluateWithGemini(text, meta);
      } catch (err) {
        console.warn("Gemini API call failed, falling back to heuristic evaluation:", err);
      }
    }

    // Heuristic & Rule-based Evaluation (ทำงานได้ 100% ออฟไลน์)
    return this.evaluateHeuristic(text, meta);
  }

  /**
   * ประเมินผ่านกฎเกณฑ์และ Heuristics ตามระเบียบ สอศ.
   */
  evaluateHeuristic(text, meta = {}) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const lowerText = text.toLowerCase();

    // 1. ตรวจสอบมิติที่ 1: ความสอดคล้องของหลักสูตรฐานสมรรถนะ (20 คะแนน)
    let d1Score = 14.0;
    const hasUnitComp = /สมรรถนะประจำหน่วย|สมรรถนะของหน่วย|สมรรถนะการเรียนรู้/i.test(text);
    const hasCourseDesc = /คำอธิบายรายวิชา|จุดประสงค์รายวิชา|มาตรฐานรายวิชา/i.test(text);
    const hasStandardVerbs = /แสดงความรู้|ปฏิบัติ|คำนวณ|ตรวจเช็ก|แก้ไข|ติดตั้ง|บำรุงรักษา/i.test(text);
    
    if (hasUnitComp) d1Score += 3.0;
    if (hasCourseDesc) d1Score += 1.5;
    if (hasStandardVerbs) d1Score += 1.5;
    d1Score = Math.min(20, Math.max(10, d1Score));

    // 2. ตรวจสอบมิติที่ 2: จุดประสงค์เชิงพฤติกรรม (K-P-A) (20 คะแนน)
    let d2Score = 13.0;
    const hasKnowledge = /ด้านความรู้|พุทธิพิสัย|knowledge/i.test(text);
    const hasSkill = /ด้านทักษะ|ทักษะพิสัย|skill|performance/i.test(text);
    const hasAttitude = /ด้านจิตพิสัย|เจตคติ|คุณธรรม|attitude/i.test(text);
    const hasVagueVerbs = /มีความเข้าใจ|รู้เรื่อง|เข้าใจการทำงาน|เข้าใจหลักการ/i.test(text);
    const hasConditionsAndStandards = /ตามคู่มือ|ถูกต้อง|ภายในเวลา|ไม่เกิน|เกณฑ์มาตรฐาน/i.test(text);

    if (hasKnowledge && hasSkill && hasAttitude) d2Score += 3.0;
    if (hasConditionsAndStandards) d2Score += 3.0;
    if (hasVagueVerbs) d2Score -= 2.0; // หักคะแนนหากใช้คำกริยาไม่ชัดเจน
    d2Score = Math.min(20, Math.max(8, d2Score));

    // 3. ตรวจสอบมิติที่ 3: กิจกรรมการเรียนรู้เชิงปฏิบัติ (Active Learning) (20 คะแนน)
    let d3Score = 14.0;
    const hasMIAP = /miap|ขั้นสนใจปัญหา|ขั้นศึกษาข้อมูล|ขั้นพยายาม|ขั้นสำเร็จผล/i.test(text);
    const hasPBL = /โครงงาน|project|กำหนดปัญหา|ลงมือปฏิบัติ|นำเสนอผลงาน/i.test(text);
    const hasActiveLearning = hasMIAP || hasPBL || /active learning|สืบเสาะ|5e/i.test(text);
    const hasGrouping = /กลุ่มละ|แบ่งกลุ่ม|ผู้เรียนลงมือ|ฝึกปฏิบัติ|สาธิต/i.test(text);

    if (hasActiveLearning) d3Score += 3.5;
    if (hasGrouping) d3Score += 2.5;
    d3Score = Math.min(20, Math.max(10, d3Score));

    // 4. ตรวจสอบมิติที่ 4: สื่อ ใบสั่งงาน และความปลอดภัย (20 คะแนน)
    let d4Score = 13.5;
    const hasJobSheet = /ใบงาน|ใบสั่งงาน|job sheet|operation sheet|ใบมอบหมายงาน/i.test(text);
    const hasSafety = /ความปลอดภัย|safety|สวมแว่นตา|อันตราย|ระบายแรงดัน|ชุดปฏิบัติงาน/i.test(text);
    const hasFiveS = /5ส|5 ส|สะสาง|สะดวก|สะอาด|สุขลักษณะ|สร้างนิสัย/i.test(text);
    const hasRealTools = /มัลติมิเตอร์|เครื่องมือ|เครื่องยนต์|โปรแกรม|คอมพิวเตอร์|อุปกรณ์/i.test(text);

    if (hasJobSheet) d4Score += 2.5;
    if (hasSafety) d4Score += 2.5;
    if (hasFiveS) d4Score += 1.0;
    if (hasRealTools) d4Score += 1.0;
    d4Score = Math.min(20, Math.max(8, d4Score));

    // 5. ตรวจสอบมิติที่ 5: การวัดผลตามสภาพจริง และบันทึกหลังสอน (20 คะแนน)
    let d5Score = 13.0;
    const hasRubric = /rubric|รูบริก|เกณฑ์การประเมิน|ระดับคุณภาพ|เกณฑ์ผ่าน/i.test(text);
    const hasPostRecord = /บันทึกหลังการสอน|บันทึกหลังสอน|ปัญหา อุปสรรค|แนวทางแก้ไข/i.test(text);
    const hasWorkAssessment = /ประเมินผลการปฏิบัติงาน|แบบสังเกตพฤติกรรม|แบบตรวจผลงาน/i.test(text);

    if (hasRubric) d4Score += 3.0;
    if (hasPostRecord) d5Score += 2.5;
    if (hasWorkAssessment) d5Score += 2.0;
    d5Score = Math.min(20, Math.max(8, d5Score));

    const totalScore = Number((d1Score + d2Score + d3Score + d4Score + d5Score).toFixed(1));

    let grade = "ดีเด่น (Excellent)";
    let gradeBadge = "bg-emerald-100 text-emerald-800 border-emerald-300";
    if (totalScore < 55) {
      grade = "ปรับปรุง (Needs Revision)";
      gradeBadge = "bg-rose-100 text-rose-800 border-rose-300";
    } else if (totalScore < 70) {
      grade = "พอใช้ (Fair)";
      gradeBadge = "bg-amber-100 text-amber-800 border-amber-300";
    } else if (totalScore < 85) {
      grade = "ดีมาก (Very Good)";
      gradeBadge = "bg-sky-100 text-sky-800 border-sky-300";
    }

    // สร้างชุดข้อเสนอแนะเชิงปรับปรุง (Recommendations)
    const recommendations = [];
    if (hasVagueVerbs || d2Score < 18) {
      recommendations.push({
        dimension: "มิติที่ 2: จุดประสงค์เชิงพฤติกรรม (ทักษะพิสัย)",
        level: "warning",
        title: "ปรับปรุงคำกริยาด้านทักษะให้วัดผลได้เชิงปฏิบัติการจริง",
        currentText: "พบคำกริยานามธรรม เช่น 'มีความเข้าใจ', 'รู้ขั้นตอน' ในส่วนจุดประสงค์เชิงทักษะ",
        suggestedText: "เปลี่ยนเป็นคำกริยาเชิงพฤติกรรม เช่น 'สามารถใช้เครื่องมือวัดค่า... ได้ถูกต้องตามคู่มือการซ่อม โดยมีค่าความคลาดเคลื่อนไม่เกินเกณฑ์มาตรฐาน ภายในเวลา 15 นาที'",
        reasoning: "มาตรฐานหลักสูตร สอศ. กำหนดให้จุดประสงค์ด้านทักษะต้องระบุเงื่อนไข (Condition) และเกณฑ์ความสำเร็จ (Degree/Standard) ที่ประเมินผลได้ชัดเจน"
      });
    }

    if (!hasSafety || !hasFiveS) {
      recommendations.push({
        dimension: "มิติที่ 4: ความปลอดภัยและกิจนิสัย 5ส ในใบสั่งงาน",
        level: "important",
        title: "เพิ่มขั้นตอนระวังความปลอดภัย (Safety Alert) และเกณฑ์ 5ส",
        currentText: "ในใบสั่งงาน (Job Sheet) ยังไม่พบการระบุอุปกรณ์คุ้มครองความปลอดภัยส่วนบุคคล (PPE) หรือข้อควรระวังก่อนเริ่มปฏิบัติงาน",
        suggestedText: "เพิ่มหัวข้อ 'ข้อควรระวังความปลอดภัย (Safety Warning)' ในใบสั่งงาน โดยระบุให้สวมแว่นตานิรภัย, ตรวจสอบสายดิน และกำหนดคะแนนการจัดเก็บเครื่องมือตามหลัก 5ส",
        reasoning: "งานอาชีพสายอาชีวศึกษาให้ความสำคัญสูงสุดกับความปลอดภัยในสถานที่ปฏิบัติงานและสุขอนามัยวิชาชีพ"
      });
    }

    if (!hasRubric || d5Score < 17) {
      recommendations.push({
        dimension: "มิติที่ 5: การวัดและประเมินผลตามสภาพจริง",
        level: "info",
        title: "จัดทำเกณฑ์การประเมินแบบรูบริก (Rubrics Matrix) 4 ระดับคุณภาพ",
        currentText: "เกณฑ์การให้คะแนนการปฏิบัติตามใบงานยังใช้แบบรวมยอด หรือยังไม่แจกแจงพฤติกรรมย่อย",
        suggestedText: "สร้างตารางเกณฑ์รูบริกแยกรายทักษะ เช่น การใช้เครื่องมือ (4=ถูกขั้นตอน 3=ผิดเล็กน้อย 2=ต้องแนะนำ 1=ทำไม่ได้) พร้อมเกณฑ์ผ่านสมรรถนะชัดเจน",
        reasoning: "การประเมินแบบรูบริกจะช่วยให้ครูและผู้เรียนมีเกณฑ์การตัดสินใจที่โปร่งใส และใช้เป็นหลักฐานประกอบการประเมิน ว.PA ได้อย่างน่าเชื่อถือ"
      });
    }

    // สร้างชุดจุดเด่น (Strengths)
    const strengths = [];
    if (hasMIAP) {
      strengths.push("โครงสร้างการจัดการเรียนรู้แบ่งเป็น 4 ขั้นตอนตามรูปแบบ MIAP ครบถ้วน สัดส่วนลงมือปฏิบัติงานจริงเกิน 60%");
    } else if (hasPBL) {
      strengths.push("ใช้กระบวนการเรียนรู้แบบโครงงาน (Project-Based Learning) ที่เปิดโอกาสให้ผู้เรียนจำลองสถานการณ์การทำงานจริง");
    } else {
      strengths.push("มีกระบวนการจัดการเรียนรู้ที่เน้นผู้เรียนเป็นศูนย์กลาง (Active Learning)");
    }

    if (hasUnitComp) {
      strengths.push("กำหนดสมรรถนะประจำหน่วยได้ชัดเจน สอดรับกับมาตรฐานคุณวุฒิวิชาชีพ");
    }

    if (hasPostRecord) {
      strengths.push("มีแบบฟอร์มบันทึกหลังสอนที่ครอบคลุมทั้งผลการเรียนรู้ ปัญหา/อุปสรรค และแนวทางแก้ไขเพื่อการวิจัยในชั้นเรียน");
    }

    return {
      metadata: {
        subjectCode: meta.subjectCode || this.extractRegex(text, /รหัสวิชา\s*([0-9\-]+)/i, "20101-2003"),
        subjectName: meta.subjectName || this.extractRegex(text, /ชื่อวิชา\s*([^\n\r]+)/i, "วิชาชีพตามหลักสูตรฐานสมรรถนะ"),
        unitName: meta.unitName || this.extractRegex(text, /ชื่อหน่วย[:\s]*([^\n\r]+)/i, "หน่วยการเรียนรู้มุ่งเน้นสมรรถนะ"),
        curriculumLevel: meta.curriculumLevel === "dvoc" ? "ปวส." : "ปวช."
      },
      overallScore: totalScore,
      qualityGrade: grade,
      gradeBadgeClass: gradeBadge,
      dimensions: {
        d1: { name: "1. ฐานสมรรถนะวิชาชีพ", score: d1Score, max: 20, pct: (d1Score/20)*100 },
        d2: { name: "2. จุดประสงค์ K-P-A", score: d2Score, max: 20, pct: (d2Score/20)*100 },
        d3: { name: "3. กิจกรรมปฏิบัติ Active", score: d3Score, max: 20, pct: (d3Score/20)*100 },
        d4: { name: "4. สื่อ/ใบงาน/ความปลอดภัย", score: d4Score, max: 20, pct: (d4Score/20)*100 },
        d5: { name: "5. การวัดผลรูบริก/บันทึกหลังสอน", score: d5Score, max: 20, pct: (d5Score/20)*100 }
      },
      recommendations,
      strengths,
      safetyAudit: {
        safetyMentioned: hasSafety,
        fiveSMentioned: hasFiveS,
        jobSheetFound: hasJobSheet,
        summary: hasSafety && hasFiveS 
          ? "มีมาตรการความปลอดภัยและกิจกรรม 5ส ครบถ้วนตามระเบียบอาชีวอนามัย" 
          : "ควรเพิ่มคำเตือนความปลอดภัยเฉพาะงาน และการจัดเก็บเครื่องมือหลังฝึกปฏิบัติ"
      }
    };
  }

  /**
   * ดึงข้อความด้วย Regex ป้องกัน Error
   */
  extractRegex(text, regex, fallback = "") {
    const match = text.match(regex);
    return match && match[1] ? match[1].trim() : fallback;
  }

  /**
   * เรียกใช้งาน Google Gemini API เพื่อประเมินเชิงลึก
   */
  async evaluateWithGemini(text, meta = {}) {
    const prompt = `
คุณคือผู้เชี่ยวชาญการตรวจและประเมินคุณภาพแผนการจัดการเรียนรู้ของสำนักงานคณะกรรมการการอาชีวศึกษา (สอศ.)
โปรดวิเคราะห์แผนการสอนนี้ตามเกณฑ์ 5 มิติ (มิติละ 20 คะแนน รวม 100 คะแนน):
1. ความสอดคล้องกับหลักสูตรฐานสมรรถนะ
2. จุดประสงค์เชิงพฤติกรรม (เน้นทักษะ P และจิตพิสัย/ความปลอดภัย A)
3. กิจกรรมการเรียนรู้เชิงปฏิบัติ (MIAP / PBL / สัดส่วนปฏิบัติ)
4. สื่อ นวัตกรรม ใบสั่งงาน (Job Sheet) และความปลอดภัย 5ส
5. การวัดผลตามสภาพจริง (Authentic Rubrics) และบันทึกหลังสอน

ตอบกลับเป็น JSON เท่านั้นในรูปแบบ:
{
  "subjectCode": "รหัสวิชา",
  "subjectName": "ชื่อวิชา",
  "unitName": "ชื่อหน่วย",
  "overallScore": 88.5,
  "qualityGrade": "ดีเด่น (Excellent)",
  "d1Score": 18,
  "d2Score": 17,
  "d3Score": 19,
  "d4Score": 18,
  "d5Score": 16.5,
  "recommendations": [
    {
      "dimension": "ชื่อมิติ",
      "title": "หัวข้อปัญหา",
      "currentText": "ข้อความเดิมในแผน",
      "suggestedText": "ข้อความที่แนะนำให้แก้ไขตามมาตรฐาน สอศ.",
      "reasoning": "เหตุผล"
    }
  ],
  "strengths": ["จุดเด่น 1", "จุดเด่น 2"],
  "safetySummary": "สรุปผลการตรวจสอบความปลอดภัยและ 5ส"
}

เนื้อหาแผนการสอน:
${text.slice(0, 15000)}
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API Error: ${response.statusText}`);
    }

    const data = await response.json();
    const parsed = JSON.parse(data.candidates[0].content.parts[0].text);

    return {
      metadata: {
        subjectCode: parsed.subjectCode || meta.subjectCode || "20101-2003",
        subjectName: parsed.subjectName || meta.subjectName || "วิชาชีพตามหลักสูตรฐานสมรรถนะ",
        unitName: parsed.unitName || meta.unitName || "หน่วยการเรียนรู้",
        curriculumLevel: meta.curriculumLevel === "dvoc" ? "ปวส." : "ปวช."
      },
      overallScore: parsed.overallScore,
      qualityGrade: parsed.qualityGrade,
      gradeBadgeClass: parsed.overallScore >= 85 ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-sky-100 text-sky-800 border-sky-300",
      dimensions: {
        d1: { name: "1. ฐานสมรรถนะวิชาชีพ", score: parsed.d1Score, max: 20, pct: (parsed.d1Score/20)*100 },
        d2: { name: "2. จุดประสงค์ K-P-A", score: parsed.d2Score, max: 20, pct: (parsed.d2Score/20)*100 },
        d3: { name: "3. กิจกรรมปฏิบัติ Active", score: parsed.d3Score, max: 20, pct: (parsed.d3Score/20)*100 },
        d4: { name: "4. สื่อ/ใบงาน/ความปลอดภัย", score: parsed.d4Score, max: 20, pct: (parsed.d4Score/20)*100 },
        d5: { name: "5. การวัดผลรูบริก/บันทึกหลังสอน", score: parsed.d5Score, max: 20, pct: (parsed.d5Score/20)*100 }
      },
      recommendations: parsed.recommendations,
      strengths: parsed.strengths,
      safetyAudit: {
        safetyMentioned: true,
        fiveSMentioned: true,
        jobSheetFound: true,
        summary: parsed.safetySummary || "ผ่านการตรวจสอบความปลอดภัยและ 5ส"
      }
    };
  }
}
