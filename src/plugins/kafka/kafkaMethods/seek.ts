import * as utils from '../../../utils';
import * as constants from './kafkaConstants';
import { KafkaMethodContext, KafkaMethodResult } from './kafkaMethodContext';
import { alterGroupOffsets, getRequiredGroupId, getTopicPartitionOffsets } from './kafkaUtils';

export async function seek({ session, request, onMessage }: KafkaMethodContext): Promise<KafkaMethodResult> {
  const groupId = getRequiredGroupId(request, 'seek');
  const offsets = getTopicPartitionOffsets(request);
  if (!offsets || offsets.length === 0) {
    throw new Error(`seek requires headers ${constants.KafkaTopic} and ${constants.KafkaOffset}`);
  }
  const activeConsumer = session.consumers.get(groupId);
  let mode: string;
  if (activeConsumer) {
    await activeConsumer.seek(offsets);
    mode = 'seek';
  } else {
    // without an active consumer, the committed offset of the group is reset, so the next consume starts there
    await alterGroupOffsets(session, groupId, offsets);
    mode = 'committed';
  }
  onMessage('seek', {
    protocol: 'KAFKA',
    name: `KAFKA seek ${groupId}`,
    statusCode: 0,
    statusMessage: mode,
    headers: {
      [constants.KafkaGroupId]: groupId,
      [constants.KafkaTopic]: offsets.map(obj => obj.topic),
      [constants.KafkaPartition]: offsets[0].partition,
      [constants.KafkaOffset]: offsets[0].offset,
    },
    request,
    message: `seek ${groupId} to offset ${offsets[0].offset} (${mode})`,
    body: utils.stringifySafe({ seek: true, groupId, mode, offsets }, 2),
  });
  return {};
}
