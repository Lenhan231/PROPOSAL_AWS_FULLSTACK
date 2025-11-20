"""
MonitoringStack - CloudWatch monitoring, alarms, and dashboards

Components:
- CloudWatch Dashboards: Visualize metrics
- CloudWatch Alarms: Alert on errors/performance issues
- CloudWatch Logs: Centralized logging
- X-Ray: Distributed tracing (optional)

Metrics to monitor:
- Lambda: Invocations, Errors, Duration, Throttles
- DynamoDB: Read/Write capacity, Errors
- S3: Upload count, Size, Errors
- API Gateway: Requests, Errors, Latency
"""

from aws_cdk import (
    Stack,
    aws_cloudwatch as cloudwatch,
    aws_cloudwatch_actions as cw_actions,
    aws_sns as sns,
    aws_logs as logs,
    Duration,
    CfnOutput,
)
from constructs import Construct


class MonitoringStack(Stack):
    """Stack for monitoring and observability"""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        api_stack=None,
        database_stack=None,
        storage_stack=None,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # === SNS Topic for Alarms ===
        alarm_topic = sns.Topic(
            self,
            "AlarmTopic",
            display_name="OnlineLibrary Alarms",
            topic_name=f"{construct_id}-alarms",
        )

        CfnOutput(
            self,
            "AlarmTopicArn",
            value=alarm_topic.topic_arn,
            export_name=f"{construct_id}-AlarmTopic-Arn",
        )

        # === CloudWatch Dashboard ===
        dashboard = cloudwatch.Dashboard(
            self,
            "Dashboard",
            dashboard_name=f"{construct_id}-Dashboard",
        )

        # Add widgets to dashboard
        if api_stack and hasattr(api_stack, "lambdas"):
            self._add_lambda_widgets(dashboard, api_stack.lambdas, alarm_topic)

        if database_stack and hasattr(database_stack, "table"):
            self._add_dynamodb_widgets(dashboard, database_stack.table, alarm_topic)

        if storage_stack and hasattr(storage_stack, "bucket"):
            self._add_s3_widgets(dashboard, storage_stack.bucket)

        CfnOutput(
            self,
            "DashboardUrl",
            value=f"https://console.aws.amazon.com/cloudwatch/home?region={self.region}#dashboards:name={dashboard.dashboard_name}",
            description="CloudWatch Dashboard URL",
        )

    def _add_lambda_widgets(self, dashboard, lambdas, alarm_topic):
        """Add Lambda metrics and alarms"""
        for name, fn in lambdas.items():
            # Invocations metric
            invocations = cloudwatch.Metric(
                namespace="AWS/Lambda",
                metric_name="Invocations",
                dimensions_map={"FunctionName": fn.function_name},
                statistic="Sum",
                period=Duration.minutes(5),
            )

            # Errors metric
            errors = cloudwatch.Metric(
                namespace="AWS/Lambda",
                metric_name="Errors",
                dimensions_map={"FunctionName": fn.function_name},
                statistic="Sum",
                period=Duration.minutes(5),
            )

            # Duration metric
            duration = cloudwatch.Metric(
                namespace="AWS/Lambda",
                metric_name="Duration",
                dimensions_map={"FunctionName": fn.function_name},
                statistic="Average",
                period=Duration.minutes(5),
            )

            # Add to dashboard
            dashboard.add_widgets(
                cloudwatch.GraphWidget(
                    title=f"{name} - Invocations & Errors",
                    left=[invocations],
                    right=[errors],
                    width=12,
                    height=6,
                )
            )

            dashboard.add_widgets(
                cloudwatch.GraphWidget(
                    title=f"{name} - Duration",
                    left=[duration],
                    width=12,
                    height=6,
                )
            )

            # Alarm: High error rate
            error_alarm = cloudwatch.Alarm(
                self,
                f"{name}ErrorAlarm",
                metric=errors,
                threshold=5,
                evaluation_periods=1,
                alarm_description=f"Alert when {name} has errors",
                alarm_name=f"{name}-errors",
            )
            error_alarm.add_alarm_action(cw_actions.SnsAction(alarm_topic))

            # Alarm: High duration
            duration_alarm = cloudwatch.Alarm(
                self,
                f"{name}DurationAlarm",
                metric=duration,
                threshold=5000,  # 5 seconds
                evaluation_periods=2,
                alarm_description=f"Alert when {name} duration is high",
                alarm_name=f"{name}-duration",
            )
            duration_alarm.add_alarm_action(cw_actions.SnsAction(alarm_topic))

    def _add_dynamodb_widgets(self, dashboard, table, alarm_topic):
        """Add DynamoDB metrics and alarms"""
        # Read capacity
        read_capacity = cloudwatch.Metric(
            namespace="AWS/DynamoDB",
            metric_name="ConsumedReadCapacityUnits",
            dimensions_map={"TableName": table.table_name},
            statistic="Sum",
            period=Duration.minutes(5),
        )

        # Write capacity
        write_capacity = cloudwatch.Metric(
            namespace="AWS/DynamoDB",
            metric_name="ConsumedWriteCapacityUnits",
            dimensions_map={"TableName": table.table_name},
            statistic="Sum",
            period=Duration.minutes(5),
        )

        # User errors
        user_errors = cloudwatch.Metric(
            namespace="AWS/DynamoDB",
            metric_name="UserErrors",
            dimensions_map={"TableName": table.table_name},
            statistic="Sum",
            period=Duration.minutes(5),
        )

        dashboard.add_widgets(
            cloudwatch.GraphWidget(
                title="DynamoDB - Capacity Usage",
                left=[read_capacity, write_capacity],
                width=12,
                height=6,
            )
        )

        dashboard.add_widgets(
            cloudwatch.GraphWidget(
                title="DynamoDB - Errors",
                left=[user_errors],
                width=12,
                height=6,
            )
        )

        # Alarm: High user errors
        error_alarm = cloudwatch.Alarm(
            self,
            "DynamoDBErrorAlarm",
            metric=user_errors,
            threshold=1,
            evaluation_periods=1,
            alarm_description="Alert on DynamoDB errors",
            alarm_name="dynamodb-errors",
        )
        error_alarm.add_alarm_action(cw_actions.SnsAction(alarm_topic))

    def _add_s3_widgets(self, dashboard, bucket):
        """Add S3 metrics"""
        # Bucket size
        bucket_size = cloudwatch.Metric(
            namespace="AWS/S3",
            metric_name="BucketSizeBytes",
            dimensions_map={
                "BucketName": bucket.bucket_name,
                "StorageType": "StandardStorage",
            },
            statistic="Average",
            period=Duration.days(1),
        )

        # Object count
        object_count = cloudwatch.Metric(
            namespace="AWS/S3",
            metric_name="NumberOfObjects",
            dimensions_map={
                "BucketName": bucket.bucket_name,
                "StorageType": "AllStorageTypes",
            },
            statistic="Average",
            period=Duration.days(1),
        )

        dashboard.add_widgets(
            cloudwatch.GraphWidget(
                title="S3 - Bucket Size & Object Count",
                left=[bucket_size],
                right=[object_count],
                width=12,
                height=6,
            )
        )
