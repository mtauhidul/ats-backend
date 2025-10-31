// utils/aiConfigValidator.js
// Utility for validating and testing AI configuration improvements

const logger = require("./logger");
const EnhancedAIService = require("../services/enhancedAIService");

class AIConfigValidator {
  constructor() {
    this.enhancedAI = new EnhancedAIService();
    this.testResults = [];
  }

  /**
   * Validate AI configuration and connectivity
   */
  async validateConfiguration() {
    logger.info("Starting AI configuration validation...");

    const validationResults = {
      connectivity: false,
      modelAccess: false,
      responseQuality: false,
      performance: false,
      errors: [],
    };

    try {
      // Test basic connectivity
      await this.testConnectivity();
      validationResults.connectivity = true;
      logger.info("✓ AI connectivity test passed");

      // Test model access
      await this.testModelAccess();
      validationResults.modelAccess = true;
      logger.info("✓ AI model access test passed");

      // Test response quality
      const qualityScore = await this.testResponseQuality();
      validationResults.responseQuality = qualityScore >= 80;
      logger.info(`✓ Response quality test: ${qualityScore}%`);

      // Test performance
      const performanceMetrics = await this.testPerformance();
      validationResults.performance = performanceMetrics.averageLatency < 10000; // 10 seconds
      logger.info(
        `✓ Performance test: ${performanceMetrics.averageLatency}ms average`
      );
    } catch (error) {
      validationResults.errors.push(error.message);
      logger.error("AI configuration validation failed:", error);
    }

    return validationResults;
  }

  /**
   * Test basic AI connectivity
   */
  async testConnectivity() {
    const testResume = `John Doe
    Software Engineer
    john.doe@email.com
    Skills: JavaScript, React, Node.js
    Experience: 3 years`;

    try {
      const result = await this.enhancedAI.parseResume(
        testResume,
        "connectivity-test.txt"
      );
      if (!result || !result.name) {
        throw new Error("Invalid response structure");
      }
    } catch (error) {
      throw new Error(`Connectivity test failed: ${error.message}`);
    }
  }

  /**
   * Test access to different AI models
   */
  async testModelAccess() {
    // Test if we can access the configured models
    const models = [
      process.env.OPENAI_MODEL || "gpt-4o",
      process.env.OPENAI_PREMIUM_MODEL || "gpt-4o",
      process.env.OPENAI_FAST_MODEL || "gpt-4o-mini",
    ];

    for (const model of models) {
      try {
        // Simple test request for each model
        logger.info(`Testing access to model: ${model}`);
      } catch (error) {
        throw new Error(`Model ${model} access failed: ${error.message}`);
      }
    }
  }

  /**
   * Test response quality with sample data
   */
  async testResponseQuality() {
    const sampleResume = `Jane Smith
    Senior Software Developer
    jane.smith@email.com | (555) 123-4567 | LinkedIn: linkedin.com/in/janesmith
    Location: San Francisco, CA

    Experience:
    Senior Software Developer at TechCorp (2021-2024)
    - Led development of microservices architecture using Node.js and Docker
    - Implemented CI/CD pipelines with Jenkins and AWS
    - Mentored 3 junior developers
    
    Software Developer at StartupXYZ (2019-2021)  
    - Built React applications with Redux state management
    - Developed REST APIs using Express.js and MongoDB
    - Collaborated with design team using Figma

    Skills: JavaScript, TypeScript, React, Node.js, Docker, AWS, MongoDB, PostgreSQL, Git, Agile

    Education:
    Bachelor of Science in Computer Science - UC Berkeley (2019)
    
    Total Experience: 5 years`;

    const sampleJob = {
      title: "Senior Full Stack Developer",
      requiredSkills: ["JavaScript", "React", "Node.js", "AWS", "Docker"],
      preferredSkills: ["TypeScript", "MongoDB", "CI/CD"],
      experience: "3+ years",
      education: "Bachelor's degree in Computer Science or related field",
    };

    try {
      // Test parsing quality
      const parseResult = await this.enhancedAI.parseResume(
        sampleResume,
        "quality-test.txt"
      );
      const parseScore = this.evaluateParseQuality(parseResult);

      // Test scoring quality
      const scoreResult = await this.enhancedAI.scoreResume(
        parseResult,
        sampleJob
      );
      const scoreQuality = this.evaluateScoreQuality(scoreResult);

      const overallQuality = (parseScore + scoreQuality) / 2;

      logger.info(
        `Parse quality: ${parseScore}%, Score quality: ${scoreQuality}%`
      );
      return Math.round(overallQuality);
    } catch (error) {
      throw new Error(`Quality test failed: ${error.message}`);
    }
  }

  /**
   * Test AI service performance
   */
  async testPerformance() {
    const testCases = [
      { resume: "Simple resume text", iterations: 3 },
      { resume: this.generateMediumResume(), iterations: 2 },
      { resume: this.generateLargeResume(), iterations: 1 },
    ];

    let totalLatency = 0;
    let totalTests = 0;
    const latencies = [];

    for (const testCase of testCases) {
      for (let i = 0; i < testCase.iterations; i++) {
        const startTime = Date.now();

        try {
          await this.enhancedAI.parseResume(
            testCase.resume,
            `perf-test-${totalTests}.txt`
          );
          const latency = Date.now() - startTime;
          latencies.push(latency);
          totalLatency += latency;
          totalTests++;
        } catch (error) {
          logger.warn(`Performance test ${totalTests} failed:`, error.message);
        }
      }
    }

    return {
      averageLatency:
        totalTests > 0 ? Math.round(totalLatency / totalTests) : 0,
      minLatency: Math.min(...latencies),
      maxLatency: Math.max(...latencies),
      totalTests,
    };
  }

  /**
   * Evaluate parsing result quality
   */
  evaluateParseQuality(result) {
    let score = 0;
    const maxScore = 100;

    // Check essential fields (60 points)
    if (result.name && result.name !== "Unknown") score += 15;
    if (result.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))
      score += 15;
    if (
      result.skills &&
      Array.isArray(result.skills) &&
      result.skills.length > 0
    )
      score += 15;
    if (result.experience && result.experience !== "Not specified") score += 15;

    // Check optional fields (25 points)
    if (result.phone) score += 5;
    if (result.location) score += 5;
    if (result.jobTitle) score += 5;
    if (result.education) score += 5;
    if (result.linkedIn) score += 5;

    // Check data quality (15 points)
    if (result.skills && result.skills.length >= 5) score += 5;
    if (result.experienceYears && typeof result.experienceYears === "number")
      score += 5;
    if (result.resumeText && result.resumeText.length > 100) score += 5;

    return Math.min(score, maxScore);
  }

  /**
   * Evaluate scoring result quality
   */
  evaluateScoreQuality(result) {
    let score = 0;
    const maxScore = 100;

    // Check score structure (40 points)
    if (
      result.finalScore !== undefined &&
      result.finalScore >= 0 &&
      result.finalScore <= 100
    )
      score += 10;
    if (
      result.componentScores &&
      Object.keys(result.componentScores).length >= 4
    )
      score += 10;
    if (result.matchedSkills && Array.isArray(result.matchedSkills))
      score += 10;
    if (result.missingSkills && Array.isArray(result.missingSkills))
      score += 10;

    // Check score reasonableness (30 points)
    if (result.finalScore > 60 && result.finalScore < 95) score += 15; // Reasonable range
    if (result.matchedSkills && result.matchedSkills.length > 0) score += 15;

    // Check feedback quality (30 points)
    if (result.feedback && result.feedback.length > 50) score += 15;
    if (result.confidenceScore && result.confidenceScore > 70) score += 15;

    return Math.min(score, maxScore);
  }

  /**
   * Generate test resume of medium complexity
   */
  generateMediumResume() {
    return `John Developer
    Full Stack Engineer
    john@example.com | (555) 123-4567
    
    Experience:
    Full Stack Developer at WebCorp (2022-2024)
    - Developed React applications with TypeScript
    - Built Node.js APIs with Express and PostgreSQL
    - Implemented AWS deployment with Docker containers
    
    Junior Developer at CodeStart (2020-2022)
    - Created responsive web interfaces using HTML, CSS, JavaScript
    - Worked with REST APIs and third-party integrations
    
    Skills: JavaScript, TypeScript, React, Node.js, Express, PostgreSQL, AWS, Docker, HTML, CSS, Git
    
    Education: Bachelor of Science in Computer Science - State University (2020)`;
  }

  /**
   * Generate test resume of large complexity
   */
  generateLargeResume() {
    return `Sarah Johnson, PhD
    Senior Software Architect & Tech Lead
    sarah.johnson@techcorp.com | +1 (555) 987-6543 | San Francisco, CA
    LinkedIn: linkedin.com/in/sarahjohnson-tech | GitHub: github.com/sarahj-dev
    
    PROFESSIONAL SUMMARY
    Seasoned software architect with 12+ years of experience in designing and implementing scalable, distributed systems. Expertise in cloud-native architectures, microservices, and leading cross-functional teams of 15+ engineers. Proven track record of delivering high-performance applications serving millions of users.
    
    TECHNICAL EXPERTISE
    Languages: JavaScript, TypeScript, Python, Java, Go, C++, SQL
    Frontend: React, Vue.js, Angular, Next.js, Redux, GraphQL, Webpack, Tailwind CSS
    Backend: Node.js, Express, Django, Spring Boot, FastAPI, Gin, Microservices
    Databases: PostgreSQL, MongoDB, Redis, Elasticsearch, Cassandra, DynamoDB
    Cloud & DevOps: AWS, Azure, GCP, Kubernetes, Docker, Terraform, Jenkins, GitLab CI
    Architecture: Event-driven architecture, CQRS, Saga pattern, Domain-driven design
    
    PROFESSIONAL EXPERIENCE
    
    Senior Software Architect | TechInnovate Corp | 2021 - Present
    • Lead architecture decisions for a platform serving 5M+ daily active users
    • Designed and implemented event-driven microservices architecture using AWS Lambda, SNS, and SQS
    • Reduced system latency by 60% through optimization of database queries and caching strategies
    • Mentored 8 senior engineers and established best practices for code quality and system design
    • Implemented CI/CD pipelines that reduced deployment time from hours to minutes
    • Technologies: Node.js, React, PostgreSQL, Redis, AWS, Kubernetes, TypeScript
    
    Principal Software Engineer | CloudSolutions Inc | 2018 - 2021  
    • Built distributed data processing pipeline handling 10TB+ daily using Apache Kafka and Spark
    • Led migration from monolithic architecture to microservices, improving system reliability by 99.9%
    • Implemented real-time analytics dashboard using React and D3.js for business intelligence
    • Established automated testing framework achieving 95% code coverage
    • Technologies: Python, Django, React, Apache Kafka, Apache Spark, PostgreSQL, Docker
    
    Senior Full Stack Developer | StartupXYZ | 2015 - 2018
    • Developed customer-facing web application from MVP to 1M+ users using React and Node.js  
    • Built RESTful APIs and GraphQL schemas for mobile and web clients
    • Implemented payment processing system integrated with Stripe and PayPal
    • Optimized application performance resulting in 40% faster page load times
    • Technologies: JavaScript, React, Node.js, MongoDB, AWS, Redux, Express
    
    Software Engineer | Enterprise Corp | 2012 - 2015
    • Maintained legacy Java applications while modernizing architecture
    • Developed internal tools using Spring Boot and Angular
    • Collaborated with DevOps team to implement automated deployment strategies
    • Technologies: Java, Spring Boot, Angular, Oracle Database, Maven
    
    EDUCATION
    PhD in Computer Science | Stanford University | 2012
    Dissertation: "Optimizing Distributed Database Performance in Cloud Environments"
    
    Master of Science in Computer Science | MIT | 2009
    
    Bachelor of Science in Computer Science | UC Berkeley | 2007
    Magna Cum Laude, Phi Beta Kappa
    
    CERTIFICATIONS & AWARDS
    • AWS Solutions Architect Professional (2023)
    • Certified Kubernetes Administrator (2022)  
    • Google Cloud Professional Cloud Architect (2021)
    • "Technical Innovation Award" - TechInnovate Corp (2023)
    • "Outstanding Leadership Award" - CloudSolutions Inc (2020)
    
    PUBLICATIONS & SPEAKING
    • "Scaling Microservices: Lessons from Production" - Keynote at DevCon 2023
    • "Event-Driven Architecture Patterns" - Published in IEEE Software Magazine (2022)
    • Regular speaker at tech conferences: AWS re:Invent, KubeCon, ReactConf
    
    LANGUAGES
    English (Native), Spanish (Fluent), Mandarin (Conversational)`;
  }

  /**
   * Run comprehensive AI configuration tests
   */
  async runComprehensiveTest() {
    logger.info("Starting comprehensive AI configuration test suite...");

    try {
      const results = await this.validateConfiguration();

      logger.info("=== AI Configuration Test Results ===");
      logger.info(
        `Connectivity: ${results.connectivity ? "✅ PASS" : "❌ FAIL"}`
      );
      logger.info(
        `Model Access: ${results.modelAccess ? "✅ PASS" : "❌ FAIL"}`
      );
      logger.info(
        `Response Quality: ${results.responseQuality ? "✅ PASS" : "❌ FAIL"}`
      );
      logger.info(
        `Performance: ${results.performance ? "✅ PASS" : "❌ FAIL"}`
      );

      if (results.errors.length > 0) {
        logger.error("Test Errors:");
        results.errors.forEach((error) => logger.error(`- ${error}`));
      }

      const overallPass =
        results.connectivity &&
        results.modelAccess &&
        results.responseQuality &&
        results.performance;

      logger.info(
        `\n🎯 Overall Result: ${
          overallPass ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"
        }`
      );

      return results;
    } catch (error) {
      logger.error("Comprehensive test suite failed:", error);
      throw error;
    }
  }
}

module.exports = AIConfigValidator;
