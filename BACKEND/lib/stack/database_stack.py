from aws_cdk import (
    Stack,
    aws_dynamodb as dynamodb,
    CfnOutput,
    RemovalPolicy,
)
from constructs import Construct


class DatabaseStack(Stack):
    """Stack for DynamoDB table and indexes"""

    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # TODO: Create main table
        table = dynamodb.Table(
            self,
            "OnlineLibraryTable",
            table_name="OnlineLibrary",
            partition_key=dynamodb.Attribute(
                name="PK",
                type=dynamodb.AttributeType.STRING,
            ),
            sort_key=dynamodb.Attribute(
                name="SK",
                type=dynamodb.AttributeType.STRING,
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,  # On-Demand
            removal_policy=RemovalPolicy.DESTROY,  # For dev ,
            time_to_live_attribute="ttl"   
        )

        # TODO: Add GSI1, GSI2, GSI3, GSI5, GSI6

        # === GSI1 – title search: GSI1PK, GSI1SK ===
        table.add_global_secondary_index(
            index_name="GSI1",
            partition_key=dynamodb.Attribute(
                name="GSI1PK",
                type=dynamodb.AttributeType.STRING,
            ),
            sort_key=dynamodb.Attribute(
                name="GSI1SK",
                type=dynamodb.AttributeType.STRING,
            ),
            projection_type=dynamodb.ProjectionType.ALL,
        )

        # === GSI2 – author search: GSI2PK, GSI2SK ===
        table.add_global_secondary_index(
            index_name="GSI2",
            partition_key=dynamodb.Attribute(
                name="GSI2PK",
                type=dynamodb.AttributeType.STRING,
            ),
            sort_key=dynamodb.Attribute(
                name="GSI2SK",
                type=dynamodb.AttributeType.STRING,
            ),
            projection_type=dynamodb.ProjectionType.ALL,
        )

        # === GSI3 – email lookup: GSI3PK, GSI3SK ===
        table.add_global_secondary_index(
            index_name="GSI3",
            partition_key=dynamodb.Attribute(
                name="GSI3PK",
                type=dynamodb.AttributeType.STRING,
            ),
            sort_key=dynamodb.Attribute(
                name="GSI3SK",
                type=dynamodb.AttributeType.STRING,
            ),
            projection_type=dynamodb.ProjectionType.ALL,
        )

        # === GSI5 – status query (pending list): GSI5PK, GSI5SK ===
        table.add_global_secondary_index(
            index_name="GSI5",
            partition_key=dynamodb.Attribute(
                name="GSI5PK",
                type=dynamodb.AttributeType.STRING,
            ),
            sort_key=dynamodb.Attribute(
                name="GSI5SK",
                type=dynamodb.AttributeType.STRING,
            ),
            projection_type=dynamodb.ProjectionType.ALL,
        )

        # === GSI6 – uploader query (my uploads): GSI6PK, GSI6SK ===
        table.add_global_secondary_index(
            index_name="GSI6",
            partition_key=dynamodb.Attribute(
                name="GSI6PK",
                type=dynamodb.AttributeType.STRING,
            ),
            sort_key=dynamodb.Attribute(
                name="GSI6SK",
                type=dynamodb.AttributeType.STRING,
            ),
            projection_type=dynamodb.ProjectionType.ALL,
        )

        # TODO: Add outputs
        CfnOutput(
            self,
            "MainTableName",
            value=table.table_name,
            description="DynamoDB main table name",
            export_name=f"{construct_id}-MainTable-Name",
        )

        CfnOutput(
            self,
            'MainTableArn',
            value=table.table_arn,
            description="DynamoDB main table ARN",
            export_name=f"{construct_id}-MainTable-Arn",
        )

        # Store table reference for other stacks
        self.table = table