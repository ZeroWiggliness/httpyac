import * as utils from '../../../utils';
import * as constants from './kafkaConstants';
import { KafkaMethodContext, KafkaMethodResult } from './kafkaMethodContext';
import { getRequiredGroupId, getTopicPartitionOffsets, withTemporaryConsumer } from './kafkaUtils';

export async function commit({ session, request, onMessage }: KafkaMethodContext): Promise<KafkaMethodResult> {
  const groupId = getRequiredGroupId(request, 'commit');
  const offsets = getTopicPartitionOffsets(request);
  const activeConsumer = session.consumers.get(groupId);

  let mode: string;
  if (activeConsumer) {
    await activeConsumer.commitOffsets(offsets);
    mode = offsets ? 'active consumer' : 'active consumer (consumed offsets)';
  } else if (offsets && offsets.length > 0) {
    await withTemporaryConsumer(session, groupId, consumer => consumer.commitOffsets(offsets));
    mode = 'group';
  } else {
    throw new Error(
      `no active consumer for ${constants.KafkaGroupId} ${groupId}. Use ${constants.KafkaTopic} and ${constants.KafkaOffset} to commit explicit offsets.`
    );
  }
  onMessage('commit', {
    protocol: 'KAFKA',
    name: `KAFKA commit ${groupId}`,
    statusCode: 0,
    statusMessage: 'committed',
    headers: {
      [constants.KafkaGroupId]: groupId,
      [constants.KafkaTopic]: offsets?.map(obj => obj.topic),
      [constants.KafkaPartition]: offsets?.[0]?.partition,
      [constants.KafkaOffset]: offsets?.[0]?.offset,
    },
    request,
    message: `commit ${groupId} (${mode})`,
    body: utils.stringifySafe({ committed: true, groupId, mode, offsets }, 2),
  });
  return {};
}
