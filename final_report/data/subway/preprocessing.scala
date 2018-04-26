import org.apache.spark.SparkConf
import org.apache.spark.sql.SparkSession
import org.apache.spark.sql.functions.{split, monotonically_increasing_id, substring}
import org.apache.spark.sql.functions.{udf, min}
import org.apache.spark.ml.feature.VectorAssembler
import org.apache.spark.ml.linalg.{Vector, Vectors}
import org.apache.spark.sql.functions._

object preprocessing {
  def feb(line: String, line2: String): Boolean = {
    line.contains("2015-02") && line2.contains("2015-02")
  }

  def main(args: Array[String]) = {
    val conf: SparkConf = new SparkConf().setMaster("local[*]").setAppName("taste_profile")
    val spark = SparkSession.builder().config(conf).getOrCreate()
    import spark.implicits._

    var df = spark.read.format("csv").option("header", "true").csv("src/main/scala/taxi.csv")
    var station = spark.read.format("csv").option("header", "true").csv("src/main/scala/subway_coords_clean.csv")
    station = station.withColumn("Latitude", $"Latitude".cast("double"))
    station = station.withColumn("Longitude", $"Longitude".cast("double"))
    val assembler1 = new VectorAssembler().setInputCols(Array("Latitude", "Longitude")).setOutputCol("loc")
    station = assembler1.transform(station)

    val sub_cols_keep = Seq("ID", "loc")
    var cols = station.columns.filter(x => sub_cols_keep.contains(x)).map(x => station.col(x))
    station = station.select(cols:_*)

    val time_to_interval = udf {(line: Int) =>
      if (4 < line && line < 8){"04-08"}
      else if (8 < line && line < 12){"08-12"}
      else if (12 < line && line < 16){"12-16"}
      else if (16 < line && line < 20){"16-20"}
      else if (20 < line && line < 24){"20-24"}
      else {"00-04"}}

    df = df.withColumn("date", split($"tpep_pickup_datetime", " ")(0))
    df = df.withColumn("pickup_time", substring(split($"tpep_pickup_datetime", " ")(1), 0, 2).cast("int"))
    df = df.withColumn("pickup_time", time_to_interval($"pickup_time"))
    df = df.withColumn("dropoff_date", split($"tpep_dropoff_datetime", " ")(0))
    df = df.withColumn("dropoff_time", substring(split($"tpep_dropoff_datetime", " ")(1), 0, 2).cast("int"))
    df = df.withColumn("dropoff_time", time_to_interval($"dropoff_time"))
    df = df.withColumn("pickup_longitude", $"pickup_longitude".cast("double"))
    df = df.withColumn("pickup_latitude", $"pickup_latitude".cast("double"))
    df = df.withColumn("dropoff_longitude", $"dropoff_longitude".cast("double"))
    df = df.withColumn("dropoff_latitude", $"dropoff_latitude".cast("double"))

    val assembler2 = new VectorAssembler().setInputCols(Array("pickup_latitude", "pickup_longitude")).setOutputCol("pickup")
    val assembler3 = new VectorAssembler().setInputCols(Array("dropoff_latitude", "dropoff_longitude")).setOutputCol("dropoff")
    df = assembler2.transform(df)
    df = assembler3.transform(df)

    val colsToKeep = Seq("date", "pickup_time", "pickup", "dropoff_time", "dropoff")
    cols = df.columns.filter(x => colsToKeep.contains(x)).map(x => df.col(x))
    df = df.select(cols:_*)
    df = df.withColumn("rider_id", monotonically_increasing_id)

    var february = df.filter(x => x(0).toString.contains("2015-02"))
    var joined = february.crossJoin(station)

    val dist = udf((a: Vector, b: Vector) => Vectors.sqdist(a, b))
    joined = joined.withColumn("distance_pickup", dist($"pickup", $"loc"))
    joined = joined.withColumn("distance_dropoff", dist($"dropoff", $"loc"))
    val grouped = joined.groupBy($"rider_id").agg(min($"distance_pickup"))

    joined = grouped.join(joined,  grouped.col("rider_id") === joined.col("rider_id") &&
      grouped.col("min(distance_pickup)") === joined.col("distance_pickup"))
    val count = joined.groupBy($"ID", $"date", $"pickup_time").count()
    count.coalesce(1).write.csv("feb_pickup4.csv")
  }
}
