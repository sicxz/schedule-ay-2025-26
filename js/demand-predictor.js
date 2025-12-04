/**
 * Demand Predictor Module
 * Predicts course demand based on enrollment history, prerequisites, and program flows
 */

const DemandPredictor = (function() {
    'use strict';

    let initialized = false;
    let enrollmentData = null;
    let catalogData = null;

    // Configuration
    const CONFIG = {
        defaultEnrollmentCap: 24,
        confidenceThresholds: {
            high: 0.8,
            medium: 0.6,
            low: 0.4
        },
        weights: {
            historicalTrend: 0.40,
            prerequisiteFlow: 0.35,
            seasonality: 0.15,
            trackPopularity: 0.10
        }
    };

    /**
     * Initialize the demand predictor
     */
    async function init(options = {}) {
        try {
            // Initialize PrerequisiteGraph if available
            if (typeof PrerequisiteGraph !== 'undefined') {
                await PrerequisiteGraph.init({
                    graphPath: options.graphPath || 'data/prerequisite-graph.json',
                    enrollmentPath: options.enrollmentPath || 'enrollment-dashboard-data.json'
                });
            }

            // Load enrollment data directly for additional analysis
            const enrollmentPath = options.enrollmentPath || 'enrollment-dashboard-data.json';
            const enrollmentResponse = await fetch(enrollmentPath);
            if (enrollmentResponse.ok) {
                const data = await enrollmentResponse.json();
                enrollmentData = data.courseStats || {};
            }

            // Load course catalog
            const catalogPath = options.catalogPath || 'data/course-catalog.json';
            const catalogResponse = await fetch(catalogPath);
            if (catalogResponse.ok) {
                const data = await catalogResponse.json();
                catalogData = data.courses || data;
            }

            initialized = true;
            console.log('DemandPredictor initialized');
            return { success: true };
        } catch (error) {
            console.error('DemandPredictor init error:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Predict demand for a single course
     */
    function predictCourseDemand(courseCode, targetQuarter, targetYear = '2026-27') {
        if (!initialized) {
            console.warn('DemandPredictor not initialized');
            return null;
        }

        const normalizedCode = courseCode.replace(/\s+/g, ' ').toUpperCase();
        const enrollment = enrollmentData?.[normalizedCode];

        if (!enrollment) {
            return {
                courseCode: normalizedCode,
                predictedDemand: null,
                confidence: 0,
                recommendation: 'unknown',
                reason: 'No enrollment data available'
            };
        }

        // Calculate predictions from different sources
        const historicalPrediction = calculateHistoricalPrediction(enrollment, targetQuarter);
        const prereqPrediction = calculatePrerequisitePrediction(courseCode, targetQuarter);
        const seasonalAdjustment = calculateSeasonalAdjustment(enrollment, targetQuarter);
        const trackPopularity = calculateTrackPopularity(courseCode);

        // Weighted combination of predictions
        let predictedDemand = 0;
        let totalWeight = 0;

        if (historicalPrediction.value !== null) {
            predictedDemand += historicalPrediction.value * CONFIG.weights.historicalTrend;
            totalWeight += CONFIG.weights.historicalTrend;
        }

        if (prereqPrediction.value !== null) {
            predictedDemand += prereqPrediction.value * CONFIG.weights.prerequisiteFlow;
            totalWeight += CONFIG.weights.prerequisiteFlow;
        }

        if (seasonalAdjustment.multiplier !== 1) {
            // Apply seasonal adjustment
            predictedDemand *= seasonalAdjustment.multiplier;
        }

        if (trackPopularity.factor !== 1) {
            predictedDemand *= trackPopularity.factor;
        }

        // Normalize if we have weights
        if (totalWeight > 0) {
            predictedDemand = Math.round(predictedDemand / totalWeight);
        } else {
            predictedDemand = enrollment.average || CONFIG.defaultEnrollmentCap;
        }

        // Calculate confidence
        const confidence = calculateConfidence(
            historicalPrediction,
            prereqPrediction,
            enrollment
        );

        // Determine current capacity
        const catalogEntry = findCatalogEntry(courseCode);
        const currentCapacity = catalogEntry?.typicalEnrollmentCap || CONFIG.defaultEnrollmentCap;
        const currentSections = enrollment.sections || 1;
        const totalCapacity = currentCapacity * currentSections;

        // Generate recommendation
        const recommendation = generateRecommendation(
            predictedDemand,
            totalCapacity,
            currentSections,
            currentCapacity
        );

        return {
            courseCode: normalizedCode,
            courseName: catalogEntry?.title || '',
            predictedDemand: Math.max(0, predictedDemand),
            confidence: confidence,
            confidenceLevel: getConfidenceLevel(confidence),
            currentSections: currentSections,
            currentCapacity: totalCapacity,
            sectionCapacity: currentCapacity,
            recommendation: recommendation.action,
            suggestedSections: recommendation.sections,
            utilizationRate: Math.round((predictedDemand / totalCapacity) * 100),
            analysis: {
                historical: historicalPrediction,
                prerequisite: prereqPrediction,
                seasonal: seasonalAdjustment,
                track: trackPopularity
            },
            trend: enrollment.trend || 'stable'
        };
    }

    /**
     * Calculate prediction based on historical enrollment
     */
    function calculateHistoricalPrediction(enrollment, targetQuarter) {
        const quarterly = enrollment.quarterly || {};
        const quarterPrefix = targetQuarter.toLowerCase();

        // Get all data for this quarter across years
        const quarterData = Object.entries(quarterly)
            .filter(([key]) => key.startsWith(quarterPrefix))
            .map(([key, value]) => ({
                year: key.split('-')[1],
                enrollment: typeof value === 'object' ? value.total : value
            }))
            .sort((a, b) => parseInt(a.year) - parseInt(b.year));

        if (quarterData.length === 0) {
            return { value: enrollment.average || null, confidence: 0.3, method: 'average' };
        }

        if (quarterData.length === 1) {
            return { value: quarterData[0].enrollment, confidence: 0.5, method: 'single-point' };
        }

        // Linear regression for trend prediction
        const trend = calculateTrend(quarterData);

        // Predict next year (assuming year increments)
        const lastYear = parseInt(quarterData[quarterData.length - 1].year);
        const nextYear = lastYear + 1;
        const predicted = trend.slope * (quarterData.length) + trend.intercept;

        return {
            value: Math.round(predicted),
            confidence: Math.min(0.9, 0.5 + (quarterData.length * 0.1)),
            method: 'regression',
            trend: trend.slope > 0 ? 'growing' : trend.slope < 0 ? 'declining' : 'stable',
            dataPoints: quarterData.length
        };
    }

    /**
     * Calculate simple linear regression
     */
    function calculateTrend(dataPoints) {
        const n = dataPoints.length;
        if (n < 2) return { slope: 0, intercept: dataPoints[0]?.enrollment || 0 };

        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

        dataPoints.forEach((point, i) => {
            sumX += i;
            sumY += point.enrollment;
            sumXY += i * point.enrollment;
            sumX2 += i * i;
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        return { slope, intercept };
    }

    /**
     * Calculate prediction based on prerequisite enrollment
     */
    function calculatePrerequisitePrediction(courseCode, targetQuarter) {
        if (typeof PrerequisiteGraph === 'undefined') {
            return { value: null, confidence: 0 };
        }

        const pipeline = PrerequisiteGraph.calculatePipeline(courseCode, targetQuarter);

        if (!pipeline || pipeline.sources.length === 0) {
            return { value: null, confidence: 0, reason: 'No prerequisites' };
        }

        return {
            value: pipeline.total,
            confidence: 0.7,
            method: 'pipeline',
            sources: pipeline.sources
        };
    }

    /**
     * Calculate seasonal adjustment
     */
    function calculateSeasonalAdjustment(enrollment, targetQuarter) {
        const quarterly = enrollment.quarterly || {};
        const quarterPrefix = targetQuarter.toLowerCase();

        // Calculate average for target quarter vs overall average
        const quarterValues = Object.entries(quarterly)
            .filter(([key]) => key.startsWith(quarterPrefix))
            .map(([, value]) => typeof value === 'object' ? value.total : value);

        if (quarterValues.length === 0) {
            return { multiplier: 1, reason: 'No seasonal data' };
        }

        const quarterAvg = quarterValues.reduce((a, b) => a + b, 0) / quarterValues.length;
        const overallAvg = enrollment.average || quarterAvg;

        const multiplier = overallAvg > 0 ? quarterAvg / overallAvg : 1;

        return {
            multiplier: multiplier,
            quarterAverage: Math.round(quarterAvg),
            overallAverage: overallAvg,
            adjustment: multiplier > 1 ? 'higher' : multiplier < 1 ? 'lower' : 'normal'
        };
    }

    /**
     * Calculate track popularity factor
     */
    function calculateTrackPopularity(courseCode) {
        if (typeof PrerequisiteGraph === 'undefined') {
            return { factor: 1 };
        }

        const tracks = PrerequisiteGraph.getTracksForCourse(courseCode);

        if (tracks.length === 0) {
            return { factor: 1, reason: 'No track assignment' };
        }

        // Track popularity weights (could be data-driven in future)
        const trackWeights = {
            'web-development': 1.15,
            'ux-interaction': 1.10,
            'animation': 1.05,
            'game-design': 1.0,
            'typography': 0.95,
            'photography': 0.90,
            'foundations': 1.0,
            'professional': 1.0
        };

        // Average the weights of all tracks this course belongs to
        const weights = tracks.map(t => trackWeights[t] || 1.0);
        const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;

        return {
            factor: avgWeight,
            tracks: tracks
        };
    }

    /**
     * Calculate overall confidence score
     */
    function calculateConfidence(historical, prereq, enrollment) {
        let confidence = 0;
        let factors = 0;

        // Historical data confidence
        if (historical.confidence) {
            confidence += historical.confidence * 0.5;
            factors += 0.5;
        }

        // Prerequisite flow confidence
        if (prereq.confidence) {
            confidence += prereq.confidence * 0.3;
            factors += 0.3;
        }

        // Data quality bonus
        if (enrollment.sections >= 3) {
            confidence += 0.1;
            factors += 0.1;
        }

        if (!enrollment.isNew) {
            confidence += 0.1;
            factors += 0.1;
        }

        return factors > 0 ? Math.min(1, confidence / factors) : 0.5;
    }

    /**
     * Get confidence level label
     */
    function getConfidenceLevel(confidence) {
        if (confidence >= CONFIG.confidenceThresholds.high) return 'high';
        if (confidence >= CONFIG.confidenceThresholds.medium) return 'medium';
        return 'low';
    }

    /**
     * Generate section recommendation
     */
    function generateRecommendation(demand, totalCapacity, currentSections, sectionCap) {
        const utilizationRate = demand / totalCapacity;

        // Calculate needed sections
        const neededSections = Math.ceil(demand / sectionCap);

        if (utilizationRate > 1.1) {
            return {
                action: 'increase',
                sections: neededSections,
                reason: `Predicted demand (${demand}) exceeds capacity (${totalCapacity})`
            };
        } else if (utilizationRate < 0.6 && currentSections > 1) {
            return {
                action: 'reduce',
                sections: Math.max(1, neededSections),
                reason: `Low utilization (${Math.round(utilizationRate * 100)}%)`
            };
        } else if (utilizationRate >= 0.85 && utilizationRate <= 1.05) {
            return {
                action: 'optimal',
                sections: currentSections,
                reason: 'Capacity matches expected demand'
            };
        } else {
            return {
                action: 'adequate',
                sections: currentSections,
                reason: 'Current sections sufficient'
            };
        }
    }

    /**
     * Find catalog entry for a course
     */
    function findCatalogEntry(courseCode) {
        if (!catalogData) return null;

        const normalizedCode = courseCode.replace(/\s+/g, '-').toUpperCase();

        if (Array.isArray(catalogData)) {
            return catalogData.find(c =>
                c.code?.replace(/\s+/g, '-').toUpperCase() === normalizedCode
            );
        }

        return catalogData[normalizedCode] || null;
    }

    /**
     * Predict demand for all courses in a quarter
     */
    function predictQuarterDemand(targetQuarter, targetYear = '2026-27') {
        if (!enrollmentData) return [];

        const predictions = [];

        Object.keys(enrollmentData).forEach(courseCode => {
            const prediction = predictCourseDemand(courseCode, targetQuarter, targetYear);
            if (prediction && prediction.predictedDemand !== null) {
                predictions.push(prediction);
            }
        });

        // Sort by recommendation priority
        const priority = { increase: 1, reduce: 2, optimal: 3, adequate: 4, unknown: 5 };
        predictions.sort((a, b) => {
            const aPriority = priority[a.recommendation] || 5;
            const bPriority = priority[b.recommendation] || 5;
            if (aPriority !== bPriority) return aPriority - bPriority;
            return b.predictedDemand - a.predictedDemand;
        });

        return predictions;
    }

    /**
     * Get courses that need attention (over/under capacity)
     */
    function getCoursesNeedingAttention(targetQuarter) {
        const predictions = predictQuarterDemand(targetQuarter);

        return {
            needMoreSections: predictions.filter(p => p.recommendation === 'increase'),
            canReduceSections: predictions.filter(p => p.recommendation === 'reduce'),
            atOptimal: predictions.filter(p => p.recommendation === 'optimal'),
            adequate: predictions.filter(p => p.recommendation === 'adequate')
        };
    }

    /**
     * Identify scheduling conflicts based on demand
     */
    function identifyHighDemandConflicts(targetQuarter) {
        const predictions = predictQuarterDemand(targetQuarter);
        const highDemand = predictions.filter(p =>
            p.utilizationRate > 90 || p.recommendation === 'increase'
        );

        // Group by track to find potential conflicts
        const trackConflicts = {};

        highDemand.forEach(pred => {
            if (typeof PrerequisiteGraph !== 'undefined') {
                const tracks = PrerequisiteGraph.getTracksForCourse(pred.courseCode);
                tracks.forEach(track => {
                    if (!trackConflicts[track]) trackConflicts[track] = [];
                    trackConflicts[track].push(pred);
                });
            }
        });

        return {
            highDemandCourses: highDemand,
            potentialTrackConflicts: trackConflicts
        };
    }

    /**
     * Generate demand summary for a quarter
     */
    function generateQuarterSummary(targetQuarter) {
        const predictions = predictQuarterDemand(targetQuarter);
        const attention = getCoursesNeedingAttention(targetQuarter);

        const totalDemand = predictions.reduce((sum, p) => sum + (p.predictedDemand || 0), 0);
        const totalCapacity = predictions.reduce((sum, p) => sum + (p.currentCapacity || 0), 0);

        return {
            quarter: targetQuarter,
            totalCourses: predictions.length,
            totalPredictedDemand: totalDemand,
            totalCurrentCapacity: totalCapacity,
            overallUtilization: Math.round((totalDemand / totalCapacity) * 100),
            coursesNeedingMoreSections: attention.needMoreSections.length,
            coursesCanReduce: attention.canReduceSections.length,
            coursesAtOptimal: attention.atOptimal.length,
            avgConfidence: Math.round(
                (predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length) * 100
            ) / 100,
            topRecommendations: attention.needMoreSections.slice(0, 5)
        };
    }

    // Public API
    return {
        init,
        predictCourseDemand,
        predictQuarterDemand,
        getCoursesNeedingAttention,
        identifyHighDemandConflicts,
        generateQuarterSummary,
        CONFIG
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DemandPredictor;
}
