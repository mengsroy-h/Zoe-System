import { withLambda } from '@netlify/aws-lambda-compat';
import * as blobs from '@netlify/blobs';
import core from './_shared/zto-order-detail-core.cjs';

export default withLambda(core.createModernHandler(blobs));
