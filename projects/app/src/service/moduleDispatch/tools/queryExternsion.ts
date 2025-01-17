import type { ChatItemType } from '@fastgpt/global/core/chat/type.d';
import type {
  ModuleDispatchProps,
  ModuleDispatchResponse
} from '@fastgpt/global/core/module/type.d';
import { ModuleInputKeyEnum, ModuleOutputKeyEnum } from '@fastgpt/global/core/module/constants';
import { ModelTypeEnum, getLLMModel } from '@fastgpt/service/core/ai/model';
import { formatModelChars2Points } from '@/service/support/wallet/usage/utils';
import { queryExtension } from '@fastgpt/service/core/ai/functions/queryExtension';
import { getHistories } from '../utils';
import { hashStr } from '@fastgpt/global/common/string/tools';

type Props = ModuleDispatchProps<{
  [ModuleInputKeyEnum.aiModel]: string;
  [ModuleInputKeyEnum.aiSystemPrompt]?: string;
  [ModuleInputKeyEnum.history]?: ChatItemType[] | number;
  [ModuleInputKeyEnum.userChatInput]: string;
}>;
type Response = ModuleDispatchResponse<{
  [ModuleOutputKeyEnum.text]: string;
}>;

export const dispatchQueryExtension = async ({
  histories,
  module,
  params: { model, systemPrompt, history, userChatInput }
}: Props): Promise<Response> => {
  if (!userChatInput) {
    return Promise.reject('Question is empty');
  }

  const queryExtensionModel = getLLMModel(model);
  const chatHistories = getHistories(history, histories);

  const { extensionQueries, charsLength } = await queryExtension({
    chatBg: systemPrompt,
    query: userChatInput,
    histories: chatHistories,
    model: queryExtensionModel.model
  });

  extensionQueries.unshift(userChatInput);

  const { totalPoints, modelName } = formatModelChars2Points({
    model: queryExtensionModel.model,
    charsLength,
    modelType: ModelTypeEnum.llm
  });

  const set = new Set<string>();
  const filterSameQueries = extensionQueries.filter((item) => {
    // 删除所有的标点符号与空格等，只对文本进行比较
    const str = hashStr(item.replace(/[^\p{L}\p{N}]/gu, ''));
    if (set.has(str)) return false;
    set.add(str);
    return true;
  });

  return {
    [ModuleOutputKeyEnum.responseData]: {
      totalPoints,
      model: modelName,
      charsLength,
      query: userChatInput,
      textOutput: JSON.stringify(filterSameQueries)
    },
    [ModuleOutputKeyEnum.moduleDispatchBills]: [
      {
        moduleName: module.name,
        totalPoints,
        model: modelName,
        charsLength
      }
    ],
    [ModuleOutputKeyEnum.text]: JSON.stringify(filterSameQueries)
  };
};
