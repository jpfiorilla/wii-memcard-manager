import { Box } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";

type PipelineArrowProps = {
  isNarrow: boolean;
};

export function PipelineArrow({ isNarrow }: PipelineArrowProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 0, md: 1 },
        py: { xs: 1, md: 0 },
        color: "secondary.light",
      }}
    >
      {isNarrow ? (
        <ArrowDownwardIcon sx={{ fontSize: 36, opacity: 0.85 }} />
      ) : (
        <ArrowForwardIcon sx={{ fontSize: 40, opacity: 0.9 }} />
      )}
    </Box>
  );
}
