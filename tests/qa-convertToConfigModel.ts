/**
 * Manual QA Test Script for convertToConfigModel
 * Tests all 4 new fields and edge cases
 */

import { convertToConfigModel } from '../src/config.js';
import type {
  ConfigModelEntry,
  DefaultParameters,
  OpenRouterModel,
} from '../src/types.js';

// Test Results Tracking
let testsPassed = 0;
let testsFailed = 0;
let fieldsPresent = 0;
let _fieldsAbsent = 0;
let valuesCorrect = 0;
let valuesIncorrect = 0;

interface TestResult {
  name: string;
  passed: boolean;
  errors: string[];
  output: ConfigModelEntry | null;
}

const results: TestResult[] = [];

function _assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

// Test 1: Full model with all 4 new fields
function testFullModel(): TestResult {
  const testName = 'Full Model - All 4 Fields Present';
  const errors: string[] = [];

  try {
    const mockModel: OpenRouterModel = {
      id: 'test/model-full',
      name: 'Test Model Full',
      canonical_slug: 'test-model-full',
      hugging_face_id: 'test/model-full',
      created: 1234567890,
      description: 'A test model with all fields',
      context_length: 128000,
      architecture: {
        modality: 'text->text',
        input_modalities: ['text'],
        output_modalities: ['text'],
        tokenizer: 'cl100k_base',
        instruct_type: 'chat',
      },
      pricing: {
        prompt: '0.01',
        completion: '0.02',
        input_cache_read: '0.005',
      },
      top_provider: {
        context_length: 128000,
        max_completion_tokens: 16384,
        is_moderated: true,
      },
      per_request_limits: null,
      supported_parameters: [
        'temperature',
        'max_tokens',
        'tools',
        'top_p',
        'unknown_param',
      ],
      default_parameters: {
        temperature: 0.7,
        top_p: 0.9,
        top_k: null,
        frequency_penalty: null,
        presence_penalty: null,
        repetition_penalty: null,
      },
      expiration_date: null,
    };

    const result = convertToConfigModel(mockModel);

    // Check all 4 fields are present
    if ('max_completion_tokens' in result) fieldsPresent++;
    else {
      _fieldsAbsent++;
      errors.push('Missing: max_completion_tokens');
    }
    if ('supported_parameters' in result) fieldsPresent++;
    else {
      _fieldsAbsent++;
      errors.push('Missing: supported_parameters');
    }
    if ('default_parameters' in result) fieldsPresent++;
    else {
      _fieldsAbsent++;
      errors.push('Missing: default_parameters');
    }
    if ('is_moderated' in result) fieldsPresent++;
    else {
      _fieldsAbsent++;
      errors.push('Missing: is_moderated');
    }

    // Verify values are correct
    if (result.max_completion_tokens === 16384) valuesCorrect++;
    else {
      valuesIncorrect++;
      errors.push(
        `max_completion_tokens: expected 16384, got ${result.max_completion_tokens}`,
      );
    }
    if (
      JSON.stringify(result.supported_parameters) ===
      JSON.stringify(['temperature', 'max_tokens', 'tools', 'top_p'])
    )
      valuesCorrect++;
    else {
      valuesIncorrect++;
      errors.push(
        `supported_parameters: expected filtered list, got ${JSON.stringify(result.supported_parameters)}`,
      );
    }
    if (result.is_moderated === true) valuesCorrect++;
    else {
      valuesIncorrect++;
      errors.push(`is_moderated: expected true, got ${result.is_moderated}`);
    }

    return {
      name: testName,
      passed: errors.length === 0,
      errors,
      output: result,
    };
  } catch (e) {
    errors.push(`Exception: ${e instanceof Error ? e.message : String(e)}`);
    return { name: testName, passed: false, errors, output: null };
  }
}

// Test 2: top_provider undefined
function testTopProviderUndefined(): TestResult {
  const testName = 'Edge Case: top_provider undefined';
  const errors: string[] = [];

  try {
    const mockModel: OpenRouterModel = {
      id: 'test/no-top-provider',
      name: 'Test Model No Top Provider',
      canonical_slug: 'test-no-top',
      hugging_face_id: 'test/no-top',
      created: 1234567890,
      description: 'Test model without top_provider',
      context_length: 128000,
      architecture: {
        modality: 'text->text',
        input_modalities: ['text'],
        output_modalities: ['text'],
        tokenizer: 'cl100k_base',
        instruct_type: 'chat',
      },
      pricing: {
        prompt: '0.01',
        completion: '0.02',
        input_cache_read: '0.005',
      },
      top_provider: undefined as any,
      per_request_limits: null,
      supported_parameters: ['temperature'],
      default_parameters: {
        temperature: 0.5,
        top_p: null,
        top_k: null,
        frequency_penalty: null,
        presence_penalty: null,
        repetition_penalty: null,
      },
      expiration_date: null,
    };

    const result = convertToConfigModel(mockModel);

    // Fields should be absent when top_provider is undefined
    if (!('max_completion_tokens' in result)) {
      fieldsPresent += 0;
    } else {
      _fieldsAbsent += 0;
      errors.push(
        'Should NOT have max_completion_tokens when top_provider undefined',
      );
    }
    if (!('is_moderated' in result)) {
      fieldsPresent += 0;
    } else {
      _fieldsAbsent += 0;
      errors.push('Should NOT have is_moderated when top_provider undefined');
    }

    return {
      name: testName,
      passed: errors.length === 0,
      errors,
      output: result,
    };
  } catch (e) {
    errors.push(`Exception: ${e instanceof Error ? e.message : String(e)}`);
    return { name: testName, passed: false, errors, output: null };
  }
}

// Test 3: supported_parameters undefined
function testSupportedParamsUndefined(): TestResult {
  const testName = 'Edge Case: supported_parameters undefined';
  const errors: string[] = [];

  try {
    const mockModel: OpenRouterModel = {
      id: 'test/no-supported-params',
      name: 'Test Model No Supported Params',
      canonical_slug: 'test-no-params',
      hugging_face_id: 'test/no-params',
      created: 1234567890,
      description: 'Test model without supported_parameters',
      context_length: 128000,
      architecture: {
        modality: 'text->text',
        input_modalities: ['text'],
        output_modalities: ['text'],
        tokenizer: 'cl100k_base',
        instruct_type: 'chat',
      },
      pricing: {
        prompt: '0.01',
        completion: '0.02',
        input_cache_read: '0.005',
      },
      top_provider: {
        context_length: 128000,
        max_completion_tokens: 4096,
        is_moderated: false,
      },
      per_request_limits: null,
      supported_parameters: undefined as any,
      default_parameters: {
        temperature: 0.5,
        top_p: null,
        top_k: null,
        frequency_penalty: null,
        presence_penalty: null,
        repetition_penalty: null,
      },
      expiration_date: null,
    };

    const result = convertToConfigModel(mockModel);

    // supported_parameters should be absent when undefined
    if (!('supported_parameters' in result)) {
      fieldsPresent += 0;
    } else {
      _fieldsAbsent += 0;
      errors.push('Should NOT have supported_parameters when undefined');
    }

    // Other fields should still be present
    if ('max_completion_tokens' in result) fieldsPresent++;
    else {
      _fieldsAbsent++;
      errors.push('Missing: max_completion_tokens');
    }
    if ('is_moderated' in result) fieldsPresent++;
    else {
      _fieldsAbsent++;
      errors.push('Missing: is_moderated');
    }
    if ('default_parameters' in result) fieldsPresent++;
    else {
      _fieldsAbsent++;
      errors.push('Missing: default_parameters');
    }

    return {
      name: testName,
      passed: errors.length === 0,
      errors,
      output: result,
    };
  } catch (e) {
    errors.push(`Exception: ${e instanceof Error ? e.message : String(e)}`);
    return { name: testName, passed: false, errors, output: null };
  }
}

// Test 4: supported_parameters empty after filter
function testSupportedParamsEmptyAfterFilter(): TestResult {
  const testName = 'Edge Case: supported_parameters empty after filter';
  const errors: string[] = [];

  try {
    const mockModel: OpenRouterModel = {
      id: 'test/empty-filtered',
      name: 'Test Model Empty Filtered',
      canonical_slug: 'test-empty-filtered',
      hugging_face_id: 'test/empty-filtered',
      created: 1234567890,
      description: 'Test model with only useless params',
      context_length: 128000,
      architecture: {
        modality: 'text->text',
        input_modalities: ['text'],
        output_modalities: ['text'],
        tokenizer: 'cl100k_base',
        instruct_type: 'chat',
      },
      pricing: {
        prompt: '0.01',
        completion: '0.02',
        input_cache_read: '0.005',
      },
      top_provider: {
        context_length: 128000,
        max_completion_tokens: 4096,
        is_moderated: false,
      },
      per_request_limits: null,
      supported_parameters: [
        'useless_param1',
        'useless_param2',
        'another_useless',
      ],
      default_parameters: {
        temperature: 0.5,
        top_p: null,
        top_k: null,
        frequency_penalty: null,
        presence_penalty: null,
        repetition_penalty: null,
      },
      expiration_date: null,
    };

    const result = convertToConfigModel(mockModel);

    // supported_parameters should be absent when all params are filtered out
    if (!('supported_parameters' in result)) {
      fieldsPresent += 0;
    } else {
      _fieldsAbsent += 0;
      errors.push('Should NOT have supported_parameters when all filtered out');
    }

    return {
      name: testName,
      passed: errors.length === 0,
      errors,
      output: result,
    };
  } catch (e) {
    errors.push(`Exception: ${e instanceof Error ? e.message : String(e)}`);
    return { name: testName, passed: false, errors, output: null };
  }
}

// Test 5: default_parameters undefined
function testDefaultParamsUndefined(): TestResult {
  const testName = 'Edge Case: default_parameters undefined';
  const errors: string[] = [];

  try {
    const mockModel: OpenRouterModel = {
      id: 'test/no-default-params',
      name: 'Test Model No Default Params',
      canonical_slug: 'test-no-default',
      hugging_face_id: 'test/no-default',
      created: 1234567890,
      description: 'Test model without default_parameters',
      context_length: 128000,
      architecture: {
        modality: 'text->text',
        input_modalities: ['text'],
        output_modalities: ['text'],
        tokenizer: 'cl100k_base',
        instruct_type: 'chat',
      },
      pricing: {
        prompt: '0.01',
        completion: '0.02',
        input_cache_read: '0.005',
      },
      top_provider: {
        context_length: 128000,
        max_completion_tokens: 4096,
        is_moderated: false,
      },
      per_request_limits: null,
      supported_parameters: ['temperature'],
      default_parameters: undefined as any,
      expiration_date: null,
    };

    const result = convertToConfigModel(mockModel);

    // default_parameters should be absent when undefined
    if (!('default_parameters' in result)) {
      fieldsPresent += 0;
    } else {
      _fieldsAbsent += 0;
      errors.push('Should NOT have default_parameters when undefined');
    }

    // Other fields should still be present
    if ('max_completion_tokens' in result) fieldsPresent++;
    else {
      _fieldsAbsent++;
      errors.push('Missing: max_completion_tokens');
    }
    if ('supported_parameters' in result) fieldsPresent++;
    else {
      _fieldsAbsent++;
      errors.push('Missing: supported_parameters');
    }
    if ('is_moderated' in result) fieldsPresent++;
    else {
      _fieldsAbsent++;
      errors.push('Missing: is_moderated');
    }

    return {
      name: testName,
      passed: errors.length === 0,
      errors,
      output: result,
    };
  } catch (e) {
    errors.push(`Exception: ${e instanceof Error ? e.message : String(e)}`);
    return { name: testName, passed: false, errors, output: null };
  }
}

// Test 6: default_parameters with null values
function testDefaultParamsWithNulls(): TestResult {
  const testName = 'Edge Case: default_parameters with all null values';
  const errors: string[] = [];

  try {
    const mockModel: OpenRouterModel = {
      id: 'test/null-defaults',
      name: 'Test Model Null Defaults',
      canonical_slug: 'test-null-defaults',
      hugging_face_id: 'test/null-defaults',
      created: 1234567890,
      description: 'Test model with all null default parameters',
      context_length: 128000,
      architecture: {
        modality: 'text->text',
        input_modalities: ['text'],
        output_modalities: ['text'],
        tokenizer: 'cl100k_base',
        instruct_type: 'chat',
      },
      pricing: {
        prompt: '0.01',
        completion: '0.02',
        input_cache_read: '0.005',
      },
      top_provider: {
        context_length: 128000,
        max_completion_tokens: 4096,
        is_moderated: false,
      },
      per_request_limits: null,
      supported_parameters: ['temperature'],
      default_parameters: {
        temperature: null,
        top_p: null,
        top_k: null,
        frequency_penalty: null,
        presence_penalty: null,
        repetition_penalty: null,
      },
      expiration_date: null,
    };

    const result = convertToConfigModel(mockModel);

    // default_parameters should be present even with null values (pass-through)
    if ('default_parameters' in result) fieldsPresent++;
    else {
      _fieldsAbsent++;
      errors.push('Missing: default_parameters');
    }

    // Verify nulls are preserved
    const dp = result.default_parameters;
    if (dp) {
      const nullFields = [
        'temperature',
        'top_p',
        'top_k',
        'frequency_penalty',
        'presence_penalty',
        'repetition_penalty',
      ];
      for (const field of nullFields) {
        if (dp[field as keyof DefaultParameters] !== null) {
          valuesIncorrect++;
          errors.push(
            `default_parameters.${field}: expected null, got ${dp[field as keyof DefaultParameters]}`,
          );
        } else {
          valuesCorrect++;
        }
      }
    }

    return {
      name: testName,
      passed: errors.length === 0,
      errors,
      output: result,
    };
  } catch (e) {
    errors.push(`Exception: ${e instanceof Error ? e.message : String(e)}`);
    return { name: testName, passed: false, errors, output: null };
  }
}

// Test 7: max_completion_tokens is 0 (falsy but valid?)
function testMaxCompletionTokensZero(): TestResult {
  const testName = 'Edge Case: max_completion_tokens = 0';
  const errors: string[] = [];

  try {
    const mockModel: OpenRouterModel = {
      id: 'test/zero-max-tokens',
      name: 'Test Model Zero Max Tokens',
      canonical_slug: 'test-zero-tokens',
      hugging_face_id: 'test/zero-tokens',
      created: 1234567890,
      description: 'Test model with 0 max_completion_tokens',
      context_length: 128000,
      architecture: {
        modality: 'text->text',
        input_modalities: ['text'],
        output_modalities: ['text'],
        tokenizer: 'cl100k_base',
        instruct_type: 'chat',
      },
      pricing: {
        prompt: '0.01',
        completion: '0.02',
        input_cache_read: '0.005',
      },
      top_provider: {
        context_length: 128000,
        max_completion_tokens: 0,
        is_moderated: false,
      },
      per_request_limits: null,
      supported_parameters: ['temperature'],
      default_parameters: {
        temperature: 0.5,
        top_p: null,
        top_k: null,
        frequency_penalty: null,
        presence_penalty: null,
        repetition_penalty: null,
      },
      expiration_date: null,
    };

    const result = convertToConfigModel(mockModel);

    // max_completion_tokens should be absent when 0 (falsy value)
    if (!('max_completion_tokens' in result)) {
      fieldsPresent += 0;
    } else {
      _fieldsAbsent += 0;
      errors.push(
        'Should NOT have max_completion_tokens when value is 0 (falsy)',
      );
    }

    return {
      name: testName,
      passed: errors.length === 0,
      errors,
      output: result,
    };
  } catch (e) {
    errors.push(`Exception: ${e instanceof Error ? e.message : String(e)}`);
    return { name: testName, passed: false, errors, output: null };
  }
}

// Test 8: is_moderated explicitly false
function testIsModeratedFalse(): TestResult {
  const testName = 'Edge Case: is_moderated = false';
  const errors: string[] = [];

  try {
    const mockModel: OpenRouterModel = {
      id: 'test/not-moderated',
      name: 'Test Model Not Moderated',
      canonical_slug: 'test-not-moderated',
      hugging_face_id: 'test/not-moderated',
      created: 1234567890,
      description: 'Test model with is_moderated = false',
      context_length: 128000,
      architecture: {
        modality: 'text->text',
        input_modalities: ['text'],
        output_modalities: ['text'],
        tokenizer: 'cl100k_base',
        instruct_type: 'chat',
      },
      pricing: {
        prompt: '0.01',
        completion: '0.02',
        input_cache_read: '0.005',
      },
      top_provider: {
        context_length: 128000,
        max_completion_tokens: 4096,
        is_moderated: false,
      },
      per_request_limits: null,
      supported_parameters: ['temperature'],
      default_parameters: {
        temperature: 0.5,
        top_p: null,
        top_k: null,
        frequency_penalty: null,
        presence_penalty: null,
        repetition_penalty: null,
      },
      expiration_date: null,
    };

    const result = convertToConfigModel(mockModel);

    // is_moderated should be present even when false
    if ('is_moderated' in result) fieldsPresent++;
    else {
      _fieldsAbsent++;
      errors.push('Missing: is_moderated should be present even when false');
    }
    if (result.is_moderated === false) valuesCorrect++;
    else {
      valuesIncorrect++;
      errors.push(`is_moderated: expected false, got ${result.is_moderated}`);
    }

    return {
      name: testName,
      passed: errors.length === 0,
      errors,
      output: result,
    };
  } catch (e) {
    errors.push(`Exception: ${e instanceof Error ? e.message : String(e)}`);
    return { name: testName, passed: false, errors, output: null };
  }
}

// Run all tests
function runTests() {
  console.log('='.repeat(80));
  console.log('QA TEST: convertToConfigModel - 4 New Fields Verification');
  console.log('='.repeat(80));
  console.log();

  // Reset counters for fields check
  fieldsPresent = 0;
  _fieldsAbsent = 0;
  valuesCorrect = 0;
  valuesIncorrect = 0;

  const testFunctions = [
    testFullModel,
    testTopProviderUndefined,
    testSupportedParamsUndefined,
    testSupportedParamsEmptyAfterFilter,
    testDefaultParamsUndefined,
    testDefaultParamsWithNulls,
    testMaxCompletionTokensZero,
    testIsModeratedFalse,
  ];

  for (const testFn of testFunctions) {
    const result = testFn();
    results.push(result);

    if (result.passed) {
      testsPassed++;
      console.log(`✅ PASS: ${result.name}`);
    } else {
      testsFailed++;
      console.log(`❌ FAIL: ${result.name}`);
      for (const error of result.errors) {
        console.log(`   - ${error}`);
      }
    }

    if (result.output) {
      console.log(
        `   Output: ${JSON.stringify(result.output, null, 2).split('\n').join('\n   ')}`,
      );
    }
    console.log();
  }

  // Summary
  console.log('='.repeat(80));
  console.log('QA SUMMARY');
  console.log('='.repeat(80));
  console.log(`Fields Present:     ${fieldsPresent}/4 (in full model test)`);
  console.log(
    `Values Correct:     ${valuesCorrect}/${valuesCorrect + valuesIncorrect}`,
  );
  console.log(
    `Edge Cases Passed:  ${testsPassed - 1}/${testFunctions.length - 1}`,
  );
  console.log(
    `Total Tests:        ${testsPassed}/${testsPassed + testsFailed} passed`,
  );
  console.log();

  const verdict = testsFailed === 0 ? 'PASS ✅' : 'FAIL ❌';
  console.log(
    `Fields [${fieldsPresent >= 4 ? 4 : fieldsPresent}/4 present] | Values [${valuesCorrect >= 3 ? 'correct' : 'incorrect'}] | Edge Cases [${testsPassed - 1}/${testFunctions.length - 1} passed] | VERDICT: ${verdict}`,
  );
  console.log('='.repeat(80));

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests();
