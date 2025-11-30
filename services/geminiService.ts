import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    errorType: {
      type: Type.STRING,
      description: "The specific exception, error code, or API error name.",
    },
    component: {
      type: Type.STRING,
      description: "The component, stage, or transformation name causing the issue.",
    },
    lineOfCode: {
      type: Type.STRING,
      description: "The approximate line number or code snippet location from the log if available.",
    },
    cause: {
      type: Type.STRING,
      description: "A concise explanation of why this error occurred.",
    },
    fix: {
      type: Type.STRING,
      description: "Step-by-step instructions to fix the error in the specific ETL tool.",
    },
    optimizedSolution: {
      type: Type.STRING,
      description: "An advanced or best-practice suggestion to prevent this in the future.",
    },
    codeSnippet: {
      type: Type.STRING,
      description: "A specific code snippet (SQL, Java, Python, Expression) to apply as a fix.",
    },
    fingerprint: {
      type: Type.STRING,
      description: "A short, unique signature string for this error (e.g., 'NPE-tMap_3-rowStruct'). Used to detect duplicate occurrences.",
    },
    jobName: {
      type: Type.STRING,
      description: "The name of the ETL job/mapping extracted from the log, if present.",
    },
    severity: {
      type: Type.STRING,
      enum: ["Critical", "High", "Medium", "Low"],
      description: "The severity level of the error. Critical = Job Failure/Data Loss, Low = Warning/Cosmetic.",
    },
    confidenceScore: {
      type: Type.NUMBER,
      description: "A number between 0 and 100 representing confidence in the solution.",
    },
  },
  required: ["errorType", "component", "cause", "fix", "optimizedSolution", "fingerprint", "severity", "confidenceScore"],
};

export const analyzeLog = async (logContent: string, toolName: string = "Talend"): Promise<AnalysisResult> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
        You are a Senior ${toolName} ETL Developer and Expert.
        Analyze the following ${toolName} job execution log or error message.
        Identify the root cause, the component responsible, and provide a concrete fix.
        
        Log Content:
        """
        ${logContent}
        """
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        systemInstruction: `You are a helpful assistant that debugs ${toolName} ETL jobs. 
        Analyze the log to find the specific error, component, and suggest a fix. 
        Also estimate the severity of the issue and your confidence in the solution.`,
      },
    });

    if (!response.text) {
      throw new Error("No response from Gemini.");
    }

    const data = JSON.parse(response.text);
    
    return {
      ...data,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      tool: toolName,
    };
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    
    // Gracefully handle 429 Quota Exceeded / Resource Exhausted errors
    if (
        error?.status === 429 || 
        error?.response?.status === 429 ||
        error?.message?.includes('429') || 
        error?.message?.includes('quota') || 
        error?.message?.includes('RESOURCE_EXHAUSTED')
    ) {
        throw new Error("⚠️ AI Quota Exceeded: The system is receiving too many requests. Please try again in a minute.");
    }

    throw error;
  }
};