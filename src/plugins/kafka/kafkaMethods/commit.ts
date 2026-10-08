import * as utils from '../../../utils';
import * as constants from './kafkaConstants';
import { KafkaMethodContext, KafkaMethodResult } from './kafkaMethodContext';
import { alterGroupOffsets, getRequiredGroupId, getTopicPartitionOffsets } from './kafkaUtils';

export async function commit({ session, request, onMessage }: KafkaMethodContext): Promise<KafkaMethodResult> {
  const groupId = getRequiredGroupId(request, 'commit');
  const offsets = getTopicPartitionOffsets(request);
  const activeConsumer = session.consumers.get(groupId);

  let mode: string;
  if (activeConsumer) {
    if (offsets) {
      await activeConsumer.consumer.commit({
        offsets: offsets.map(offset => ({
          ...offset,
          offset: BigInt(offset.offset),
          leaderEpoch:
            activeConsumer.latestMessages.get(`${offset.topic}:${offset.partition}`)?.leaderEpoch ?? -1,
        })),
      });
    } else {
      await Promise.all([...activeConsumer.latestMessages.values()].map(message => message.commit()));
    }
    mode = offsets ? 'active consumer' : 'active consumer (consumed offsets)';
  } else if (offsets && offsets.length > 0) {
    await alterGroupOffsets(session, groupId, offsets);
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
